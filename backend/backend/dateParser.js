/**
 * Strict date parser (YYYY-MM-DD only)
 * Returns { start, end } timestamps or null
 */

function parseISODate(input) {
  const match = input.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return null;

  const [_, y, m, d] = match.map(Number);

  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();

  if (isNaN(start) || isNaN(end)) return null;

  return { start, end };
}

module.exports = { parseISODate };