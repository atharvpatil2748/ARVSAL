/**
 * Recall Router
 *
 * - LAST resort only
 * - Meaning-based recall
 * - Uses vector similarity + importance
 * - Read-only, safe
 */

const { embedText } = require("./embeddingModel");
const { searchVectors } = require("./vectorStore");


/**
 * Meaning-based memory recall
 * @param {string} query
 * @param {string} subject
 * @returns {string[] | null}
 */
async function recallByMeaning(query, subject = "user") {
  if (!query || typeof query !== "string") return null;

  const embedding = await embedText(query);
  if (!Array.isArray(embedding)) return null;

  // Normalize subject safely
  const safeSubject =
    typeof subject === "string" && subject.trim()
      ? subject.toLowerCase()
      : null;

  const results = searchVectors(embedding, {
    subject: safeSubject,
    limit: 5,
    minScore: 0.48
  });

  if (!Array.isArray(results) || !results.length) return null;

  const texts = results
    .map(r => r.text)
    .filter(Boolean);

  if (!texts.length) return null;

  // 🔒 Deduplicate similar outputs
  const unique = [];
  const seen = new Set();

  for (const t of texts) {
    const key = t.toLowerCase().slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
    if (unique.length >= 3) break;
  }

  return unique.length ? unique : null;
}

module.exports = { recallByMeaning };