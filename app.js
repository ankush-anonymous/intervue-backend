// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./connect/db");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Schema and Model
const PollSchema = new mongoose.Schema({
  sessionId: String,
  question: String,
  options: [{ text: String, count: Number }],
  status: { type: String, default: "active" },
  createdAt: { type: Date, default: Date.now },
  answers: [{ studentName: String, socketId: String, optionIndex: Number }],
});
const Poll = mongoose.model("Poll", PollSchema);

// Store active sessions (in-memory for simplicity)
const sessions = new Map(); // { sessionId: { teacherSocketId, students: [{ socketId, name }] } }

// Socket.IO Connection Handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Route: Join Teacher
  socket.on("join-teacher", () => {
    sessions.set(socket.id, { teacherSocketId: socket.id, students: [] });
    console.log(`Teacher joined with session ID: ${socket.id}`);
    socket.emit("session-created", { sessionId: socket.id });
    socket.join(socket.id); // Teacher joins their own session room
  });

  // Route: Join Student
  socket.on("join-student", ({ sessionId, name }) => {
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.students.push({ socketId: socket.id, name });
      console.log(`Student ${name} joined session ${sessionId} with socket ID: ${socket.id}`);
      socket.join(sessionId); // Student joins the session room
      socket.emit("join-success", { sessionId, message: `Joined session ${sessionId}` });

      // Send active poll if exists
      Poll.findOne({ sessionId, status: "active" }).then((poll) => {
        if (poll) {
          socket.emit("new-question", poll);
        }
      });
    } else {
      socket.emit("join-error", { message: "Invalid session ID" });
    }
  });

  // Route: Create Question
  socket.on("create-question", async (data) => {
    const { question, options } = data;
    if (!sessions.has(socket.id)) {
      return socket.emit("error", { message: "No session found" });
    }

    const poll = new Poll({
      sessionId: socket.id,
      question,
      options: options.map((text) => ({ text, count: 0 })),
      answers: [],
    });

    try {
      await poll.save();
      console.log(`New poll created in session ${socket.id}: ${question}`);
      io.to(socket.id).emit("new-question", poll); // Broadcast to all in session
    } catch (err) {
      console.error("❌ Error saving poll:", err);
      socket.emit("error", { message: "Poll creation failed" });
    }

    // Start 60-second timer for poll
    setTimeout(async () => {
      poll.status = "closed";
      await poll.save();
      const results = calculateResults(poll);
      io.to(socket.id).emit("poll-results", results); // Broadcast final results
      console.log(`Poll closed in session ${socket.id}`);
    }, 60 * 1000);
  });

  // Route: Get Active Question
  socket.on("get-active-question", async ({ sessionId }) => {
    if (!sessions.has(sessionId)) {
      return socket.emit("error", { message: "Session not found" });
    }
    const poll = await Poll.findOne({ sessionId, status: "active" });
    if (poll) {
      socket.emit("new-question", poll);
    } else {
      socket.emit("error", { message: "No active poll found" });
    }
  });

  // Route: Submit Answer (for live polling results)
  socket.on("submit-answer", async ({ sessionId, name, optionIndex }) => {
    if (!sessions.has(sessionId)) {
      return socket.emit("error", { message: "Session not found" });
    }

    const poll = await Poll.findOne({ sessionId, status: "active" });
    if (!poll) {
      return socket.emit("error", { message: "No active poll found" });
    }

    // Prevent multiple submissions
    if (poll.answers.some((ans) => ans.socketId === socket.id)) {
      return socket.emit("error", { message: "You have already submitted an answer" });
    }

    poll.answers.push({ studentName: name, socketId: socket.id, optionIndex });
    poll.options[optionIndex].count += 1;
    await poll.save();

    console.log(`Answer submitted by ${name} in session ${sessionId}: Option ${optionIndex}`);

    // Broadcast live polling results
    const results = calculateResults(poll);
    io.to(sessionId).emit("poll-update", results);
  });

  // Route: Get Final Result
  socket.on("get-final-result", async ({ sessionId }) => {
    if (!sessions.has(sessionId)) {
      return socket.emit("error", { message: "Session not found" });
    }
    const poll = await Poll.findOne({ sessionId, status: "closed" }).sort({ createdAt: -1 });
    if (poll) {
      const results = calculateResults(poll);
      socket.emit("poll-results", results);
    } else {
      socket.emit("error", { message: "No final results found" });
    }
  });

  // Route: Get Students (Optional, for teacher to see joined students)
  socket.on("get-students", ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (session) {
      socket.emit("students-list", { students: session.students });
    } else {
      socket.emit("error", { message: "Session not found" });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    if (sessions.has(socket.id)) {
      sessions.delete(socket.id);
      io.to(socket.id).emit("session-ended", { message: "Teacher disconnected" });
      console.log(`Session ${socket.id} ended due to teacher disconnection`);
    } else {
      sessions.forEach((session) => {
        session.students = session.students.filter((student) => student.socketId !== socket.id);
      });
    }
  });
});

// Calculate poll results
function calculateResults(poll) {
  const totalAnswers = poll.answers.length;
  const percentages = poll.options.map((option) => ({
    text: option.text,
    count: option.count,
    percentage: totalAnswers > 0 ? ((option.count / totalAnswers) * 100).toFixed(2) : 0,
  }));
  return { question: poll.question, options: percentages, status: poll.status };
}

const port = 5000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    server.listen(port, () =>
      console.log(`LenderApp Server is listening on port ${port}...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();