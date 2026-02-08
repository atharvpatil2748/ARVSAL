/**
 * Topic / Subject Memory Manager
 * Builds subject-wise summaries from stored semantic memory
 * SAFE, deterministic, cache-aware, and time-aware
 */

const memory = require("./memory");
const askLocalLLM = require("./localLLM");


/* ================= CACHE ================= */

const summaryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes


/* ================= UTIL ================= */

function normalizeSubject(subject) {
  if (typeof subject !== "string") return null;
  const s = subject.toLowerCase().trim();
  if (!s || s === "arvsal") return null;
  return s;
}

function factsToText(facts) {
  return facts.map(f => `${f.key}: ${f.value}`).join(", ");
}

function humanTime(ts) {
  if (!ts) return "some time ago";

  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "recently";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return "a while ago";
}


/* ================= SUBJECT DISCOVERY ================= */

function getAllSubjects() {
  const subjects = new Set();

  // 🔒 Authoritative source: semantic memory store
  const store = memory && memory.facts;
  if (!store || typeof store !== "object") return [];

  for (const subject of Object.keys(store)) {
    const normalized = normalizeSubject(subject);
    if (normalized) subjects.add(normalized);
  }

  return Array.from(subjects);
}


/* ================= SUBJECT SUMMARY ================= */

async function summarizeSubject(subject) {
  subject = normalizeSubject(subject);
  if (!subject) return "I don't have enough information.";

  // 🔁 Cache
  const cached = summaryCache.get(subject);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.text;
  }

  // Reliable semantic memory only
  const facts = memory
    .summarize(subject)
    .filter(f => f.confidence >= 0.6);

  if (!facts.length) {
    return `I don't have enough reliable information about ${subject}.`;
  }

  const memoryText = factsToText(facts);

  // 🔒 Human-accurate: when it was FIRST told
  const earliest = facts.reduce(
    (min, f) => Math.min(min, f.createdAt || Date.now()),
    Date.now()
  );

  /* ================= DETERMINISTIC FALLBACK ================= */

  let summary =
    `I know ${facts.map(f => f.key).join(", ")} about ${subject}. ` +
    `I remember this from ${humanTime(earliest)}.`;

  /* ================= OPTIONAL LLM POLISH ================= */

  try {
    const raw = await askLocalLLM(
`You are Arvsal.

Write ONE factual paragraph about "${subject}".

STRICT RULES:
- Use ONLY the facts provided
- Do NOT infer, assume, or generalize
- Do NOT mention memory, time, or sources
- Third person only
- Be concise and factual

Facts:
${memoryText}`
    );

    if (typeof raw === "string" && raw.trim()) {
      summary = `${raw.trim()} I remember this from ${humanTime(earliest)}.`;
    }
  } catch {
    // deterministic fallback already set
  }

  summaryCache.set(subject, {
    text: summary,
    timestamp: Date.now()
  });

  return summary;
}


module.exports = {
  summarizeSubject,
  getAllSubjects
};












// /**
//  * Topic / Subject Memory Manager
//  * Builds subject-wise summaries from stored semantic memory
//  * SAFE, deterministic, cache-aware, and time-aware
//  */

// const memory = require("./memory");
// const askLocalLLM = require("./localLLM");

// /* ================= CACHE ================= */

// const summaryCache = new Map();
// const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// /* ================= UTIL ================= */

// function normalizeSubject(subject) {
//   if (typeof subject !== "string") return null;
//   const s = subject.toLowerCase().trim();
//   if (!s || s === "arvsal") return null;
//   return s;
// }

// function factsToText(facts) {
//   return facts.map(f => `${f.key}: ${f.value}`).join(", ");
// }

// function humanTime(ts) {
//   if (!ts) return "some time ago";
//   const diff = Date.now() - ts;
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
//   if (days === 0) return "recently";
//   if (days === 1) return "yesterday";
//   if (days < 7) return `${days} days ago`;
//   if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
//   return "a while ago";
// }

// /* ================= SUBJECT DISCOVERY ================= */

// function getAllSubjects() {
//   const subjects = new Set();

//   // Discover subjects ONLY through semantic memory
//   for (const subject of Object.keys(memory.summarize ? memory.summarize("user").reduce(() => ({}), {}) : {})) {
//     const s = normalizeSubject(subject);
//     if (s) subjects.add(s);
//   }

//   // Safer approach: walk memory.facts via summarize
//   try {
//     const all = Object.keys(memory.summarize ? memory.recent("user", 100).reduce(() => ({}), {}) : {});
//     all.forEach(s => {
//       const n = normalizeSubject(s);
//       if (n) subjects.add(n);
//     });
//   } catch {}

//   return Array.from(subjects);
// }

// /* ================= SUBJECT SUMMARY ================= */

// async function summarizeSubject(subject) {
//   subject = normalizeSubject(subject);
//   if (!subject) return "I don't have enough information.";

//   // 🔁 Cache
//   const cached = summaryCache.get(subject);
//   if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
//     return cached.text;
//   }

//   // Reliable semantic memory only
//   const facts = memory
//     .summarize(subject)
//     .filter(f => f.confidence >= 0.6);

//   if (!facts.length) {
//     return `I don't have enough reliable information about ${subject}.`;
//   }

//   const memoryText = factsToText(facts);

//   const earliest = facts.reduce(
//     (min, f) => Math.min(min, f.updatedAt || Date.now()),
//     Date.now()
//   );

//   // ✅ Deterministic fallback (PRIMARY)
//   let summary =
//     `I know ${facts.map(f => f.key).join(", ")} about ${subject}. ` +
//     `I remember this from ${humanTime(earliest)}.`;

//   // 🎨 Optional LLM polish (SAFE)
//   try {
//     const raw = await askLocalLLM(
// `You are Arvsal.

// Write ONE factual paragraph about "${subject}".

// Rules (STRICT):
// - Use ONLY the facts provided
// - Third person only
// - No assumptions
// - No embellishment
// - Be concise

// Facts:
// ${memoryText}`
//     );

//     if (typeof raw === "string" && raw.trim()) {
//       summary = `${raw.trim()} I remember this from ${humanTime(earliest)}.`;
//     }
//   } catch {
//     // deterministic fallback already set
//   }

//   summaryCache.set(subject, {
//     text: summary,
//     timestamp: Date.now()
//   });

//   return summary;
// }

// module.exports = {
//   summarizeSubject,
//   getAllSubjects
// };










