/**
 * Vector Store (HARDENED)
 *
 * - Guaranteed file creation
 * - Append-only
 * - No silent failures
 * - Windows-safe
 */

const fs = require("fs");
const path = require("path");

/* ================= PATH ================= */

const FILE = path.resolve(__dirname, "vector_store.json");

/* ================= CONFIG ================= */

const MAX_VECTORS = 2000;
const VECTOR_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/* ================= STATE ================= */

let store = [];

/* ================= INIT ================= */

(function init() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, "[]", "utf8");
    }

    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);

    store = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[VECTOR] INIT FAILED:", err);
    store = [];
    try {
      fs.writeFileSync(FILE, "[]", "utf8");
    } catch {}
  }
})();

/* ================= SAVE ================= */

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[VECTOR] SAVE FAILED:", err);
  }
}

/* ================= CLEANUP ================= */

function cleanup() {
  const now = Date.now();

  store = store.filter(
    v =>
      v &&
      Array.isArray(v.embedding) &&
      typeof v.timestamp === "number" &&
      now - v.timestamp <= VECTOR_TTL_MS
  );

  if (store.length > MAX_VECTORS) {
    store = store.slice(-MAX_VECTORS);
  }

  save();
}

/* ================= ADD ================= */

function addVector(entry) {
  if (
    !entry ||
    !Array.isArray(entry.embedding) ||
    entry.embedding.length === 0 ||
    typeof entry.text !== "string"
  ) {
    return;
  }

  store.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: entry.text.trim(),
    subject: String(entry.subject || "user").toLowerCase(),
    importance:
      typeof entry.importance === "number"
        ? Math.max(0, Math.min(1, entry.importance))
        : 0.5,
    timestamp: entry.timestamp || Date.now(),
    embedding: entry.embedding
  });

  cleanup();
}

/* ================= SEARCH ================= */

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length !== b.length) return 0;

  let dot = 0,
    magA = 0,
    magB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (typeof x !== "number" || typeof y !== "number") return 0;

    dot += x * y;
    magA += x * x;
    magB += y * y;
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function searchVectors(
  queryEmbedding,
  { subject = null, limit = 5, minScore = 0.35 } = {}
) {
  if (!Array.isArray(queryEmbedding)) return [];

  const now = Date.now();
  const subj = subject ? subject.toLowerCase() : null;

  return store
    .map(v => {
      const sim = cosineSimilarity(queryEmbedding, v.embedding);
      if (sim <= 0) return null;

      const recency = Math.max(
        0,
        1 - (now - v.timestamp) / VECTOR_TTL_MS
      );

      const subjScore = subj
        ? v.subject === subj
          ? 1
          : 0.3
        : 0.5;

      const score =
        sim * 0.55 +
        (v.importance || 0.5) * 0.25 +
        recency * 0.15 +
        subjScore * 0.05;

      return { ...v, score };
    })
    .filter(v => v && v.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ================= EXPORT ================= */

module.exports = {
  addVector,
  searchVectors,
  getAll: () => store
};











// /**
//  * Vector Store
//  *
//  * - Stores embeddings
//  * - Append-only (bounded)
//  * - Ranked semantic search
//  * - NO reasoning
//  */

// const fs = require("fs");
// const path = require("path");

// const FILE = path.join(__dirname, "vector_store.json");

// /* ================= CONFIG ================= */

// const MAX_VECTORS = 2000; // 🔒 HARD CAP
// const VECTOR_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// let store = [];


// /* ================= LOAD ================= */

// if (fs.existsSync(FILE)) {
//   try {
//     store = JSON.parse(fs.readFileSync(FILE, "utf8"));
//     if (!Array.isArray(store)) store = [];
//   } catch {
//     store = [];
//   }
// }


// /* ================= SAVE ================= */

// function save() {
//   fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
// }


// /* ================= CLEANUP ================= */

// function cleanup() {
//   const now = Date.now();

//   // Remove expired vectors
//   store = store.filter(v =>
//     v &&
//     Array.isArray(v.embedding) &&
//     typeof v.timestamp === "number" &&
//     now - v.timestamp <= VECTOR_TTL_MS
//   );

//   // Hard cap (keep newest)
//   if (store.length > MAX_VECTORS) {
//     store = store.slice(-MAX_VECTORS);
//   }

//   save();
// }


// /* ================= ADD ================= */

// function addVector(entry) {
//   if (
//     !entry ||
//     !Array.isArray(entry.embedding) ||
//     typeof entry.text !== "string"
//   ) return;

//   store.push({
//     id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
//     text: entry.text,
//     subject: String(entry.subject || "user").toLowerCase(),
//     importance: typeof entry.importance === "number" ? entry.importance : 0.5,
//     timestamp: entry.timestamp || Date.now(),
//     embedding: entry.embedding
//   });

//   cleanup();
// }


// /* ================= SIMILARITY ================= */

// function cosineSimilarity(a, b) {
//   if (!Array.isArray(a) || !Array.isArray(b)) return 0;
//   if (a.length !== b.length) return 0;

//   let dot = 0, magA = 0, magB = 0;

//   for (let i = 0; i < a.length; i++) {
//     const x = a[i], y = b[i];
//     if (typeof x !== "number" || typeof y !== "number") return 0;

//     dot += x * y;
//     magA += x * x;
//     magB += y * y;
//   }

//   if (!magA || !magB) return 0;
//   return dot / (Math.sqrt(magA) * Math.sqrt(magB));
// }


// /* ================= SEARCH ================= */

// function searchVectors(
//   queryEmbedding,
//   {
//     subject = null,
//     limit = 5,
//     minScore = 0.35 // 🔒 realistic default
//   } = {}
// ) {
//   if (!Array.isArray(queryEmbedding)) return [];

//   const now = Date.now();
//   const normalizedSubject =
//     typeof subject === "string" ? subject.toLowerCase() : null;

//   const scored = store.map(v => {
//     const similarity = cosineSimilarity(queryEmbedding, v.embedding);

//     if (similarity <= 0) return null;

//     const recencyScore = Math.max(
//       0,
//       1 - (now - v.timestamp) / VECTOR_TTL_MS
//     );

//     const subjectScore =
//       normalizedSubject
//         ? v.subject === normalizedSubject ? 1 : 0.3
//         : 0.5;

//     const finalScore =
//       similarity * 0.55 +
//       (v.importance || 0.5) * 0.25 +
//       recencyScore * 0.15 +
//       subjectScore * 0.05;

//     return {
//       ...v,
//       similarity,
//       finalScore
//     };
//   });

//   return scored
//     .filter(r => r && r.finalScore >= minScore)
//     .sort((a, b) => b.finalScore - a.finalScore)
//     .slice(0, limit);
// }


// /* ================= EXPORT ================= */

// function getAll() {
//   return store;
// }

// module.exports = {
//   addVector,
//   searchVectors,
//   getAll
// };