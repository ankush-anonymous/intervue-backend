const PollModel = require("../models/pollModel");
const { calculatePercentages } = require("../utils/calculatePercentage");
const PollResult = require("../models/pollResult"); // Mongoose model

// Starts a new question, broadcasts it, and sets a timer
function handleNewQuestion(io, data) {
  const { question, options, correctAnswer } = data;

  const poll = PollModel.createPoll({ question, options, correctAnswer });

  // Emit the new question to all connected clients
  io.emit("question-started", {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    duration: 60
  });

  // Set timeout to end poll after 60 seconds
  setTimeout(() => {
    endPoll(io, poll.id);
  }, 60000);
}

// Handles an answer from a student and emits live results
function handleAnswer(io, pollId, name, answer) {
  const poll = PollModel.submitAnswer(pollId, name, answer);
  if (!poll) return;

  const liveResults = calculatePercentages(poll.answers, poll.options);

  // Emit live vote counts and percentages
  io.emit("poll-live-results", {
    pollId,
    results: liveResults,
    totalVotes: Object.keys(poll.answers).length
  });
}

// Ends poll, calculates final result, saves to DB, and broadcasts final result
async function endPoll(io, pollId) {
  const poll = PollModel.finalizePoll(pollId);
  if (!poll) return;

  const totalVotes = Object.keys(poll.answers).length;

  // Emit final result to clients
  io.emit("poll-results", {
    pollId,
    results: poll.results,
    correctAnswer: poll.correctAnswer,
    totalVotes
  });

  // Save final result to MongoDB
  try {
    const resultDoc = new PollResult({
      pollId: poll.id,
      question: poll.question,
      options: poll.options,
      correctAnswer: poll.correctAnswer,
      results: poll.results,
      totalVotes
    });
    await resultDoc.save();
    console.log("✅ Poll result saved to MongoDB");
  } catch (err) {
    console.error("❌ Failed to save poll result:", err);
  }
}

module.exports = {
  handleNewQuestion,
  handleAnswer,
  endPoll
};
