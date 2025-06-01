// utils/calculatePercentage.js
function calculatePercentages(answers, options) {
  const counts = {};
  const total = Object.keys(answers).length;

  for (const option of options) {
    counts[option] = 0;
  }

  for (const ans of Object.values(answers)) {
    if (counts.hasOwnProperty(ans)) {
      counts[ans] += 1;
    }
  }

  const percentages = {};
  for (const [key, value] of Object.entries(counts)) {
    percentages[key] = total === 0 ? "0%" : ((value / total) * 100).toFixed(2) + "%";
  }

  return { counts, percentages };
}

module.exports = { calculatePercentages };
