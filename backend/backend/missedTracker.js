let missed = {};

function addMissed(number, text) {
  if (!missed[number]) missed[number] = [];
  missed[number].push({
    time: new Date(),
    preview: text.slice(0, 50)
  });
}

function formatSummary() {
  if (Object.keys(missed).length === 0) {
    return "No missed messages.";
  }

  let result = "📩 Missed Messages Summary:\n\n";

  for (const number in missed) {
    result += `From ${number}:\n`;

    missed[number].forEach(entry => {
      const time = new Date(entry.time);
      const minutesAgo = Math.round(
        (Date.now() - time.getTime()) / 60000
      );

      result += `- ${entry.preview}\n  at ${time.toLocaleTimeString()} (${minutesAgo} min ago)\n`;
    });

    result += "\n";
  }

  return result;
}

function clearMissed() {
  missed = {};
}

module.exports = {
  addMissed,
  formatSummary,
  clearMissed
};