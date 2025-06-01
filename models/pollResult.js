// models/PollResult.js
const mongoose = require("mongoose");

const pollResultSchema = new mongoose.Schema({
  pollId: Number,
  question: String,
  options: [String],
  correctAnswer: String,
  results: {
    counts: Object,
    percentages: Object,
  },
  totalVotes: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PollResult", pollResultSchema);
