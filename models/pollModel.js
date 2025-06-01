let polls = [];

function createPoll(question) {
  const poll = {
    id: Date.now(),
    question,
    answers: {},
    createdAt: new Date(),
    completed: false,
  };
  polls.push(poll);
  return poll;
}

function submitAnswer(pollId, studentName, answer) {
  const poll = polls.find(p => p.id === pollId);
  if (!poll || poll.completed) return null;
  poll.answers[studentName] = answer;
  return poll;
}

function finalizePoll(pollId) {
  const poll = polls.find(p => p.id === pollId);
  if (!poll || poll.completed) return null;
  poll.completed = true;
  return poll;
}

function getPollResults(pollId) {
  const poll = polls.find(p => p.id === pollId);
  return poll ? poll.answers : null;
}

module.exports = { createPoll, submitAnswer, finalizePoll, getPollResults };
