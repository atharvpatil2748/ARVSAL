/**
 * Memory Search
 * - Vector similarity
 * - Importance weighted
 * - Time aware (indirect via importance)
 */

const { getAll } = require("./vectorStore");

/* ================= MATH ================= */

function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0; // 🔒 HARD GUARD

  let dot = 0;
  let ma = 0;
  let mb = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    ma += ai * ai;
    mb += bi * bi;
  }

  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  if (denom === 0) return 0;

  return dot / denom;
}

/* ================= SEARCH ================= */

function normalizeSubject(subject) {
  return subject ? String(subject).toLowerCase().trim() : null;
}

function searchByEmbedding(queryEmbedding, opts = {}) {
  if (!Array.isArray(queryEmbedding)) return [];

  const {
    subject,
    minImportance = 0.6,
    limit = 5
  } = opts;

  const normSubject = normalizeSubject(subject);

  return getAll()
    .filter(e =>
      e &&
      Array.isArray(e.embedding) &&
      (!normSubject || String(e.subject).toLowerCase() === normSubject) &&
      typeof e.importance === "number" &&
      e.importance >= minImportance
    )
    .map(e => {
      const similarity = cosineSim(queryEmbedding, e.embedding);

      // 🔒 Importance as soft weight, not hard killer
      const weightedScore =
        similarity * (0.7 + 0.3 * e.importance);

      return {
        ...e,
        score: weightedScore
      };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { searchByEmbedding };