/**
 * Memory Inspector
 * Read-only analysis of Arvsal's memory
 * NEVER writes memory
 */

const memory = require("./memory");
const episodicMemory = require("./episodicMemory");

/* ================= UTIL ================= */

function formatDateTime(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  return `${d.toDateString()} ${d.toLocaleTimeString()}`;
}

function normalizeSubject(subject) {
  return String(subject || "user").toLowerCase().trim();
}

/* ================= SUBJECT MEMORY ================= */

/**
 * Returns semantic memory for a subject
 * Human-accurate: uses createdAt (when told), not updatedAt
 */
function getSubjectMemory(subject = "user") {
  subject = normalizeSubject(subject);

  const facts = memory.summarize(subject);

  return facts.map(f => ({
    type: "semantic",
    key: f.key,
    value: f.value,
    confidence: Number(f.confidence.toFixed(2)),
    source: f.source,                // explicit | inferred
    category: f.category,
    rememberedOn: formatDateTime(f.createdAt),
    lastRecalledOn: formatDateTime(f.lastAccessedAt) // ✅ FIXED
  }));
}

/* ================= MEMORY TIMELINE ================= */

/**
 * Unified timeline of semantic + episodic memory
 * Ordered by actual occurrence time
 */
function getMemoryTimeline(subject = "user", limit = 10) {
  subject = normalizeSubject(subject);

  const semantic = memory
    .summarize(subject)
    .map(f => ({
      type: "semantic",
      key: f.key,
      value: f.value,
      source: f.source,
      time: f.createdAt   // when it was told
    }));

  const episodic = episodicMemory
    .getBySubject(subject, limit)
    .map(e => ({
      type: "episodic",
      key: e.key || null,
      value: e.value || null,
      source: e.source || "user",
      time: e.timestamp   // when it occurred
    }));

  return [...semantic, ...episodic]
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(item => ({
      type: item.type,
      key: item.key,
      value: item.value,
      source: item.source,
      rememberedOn: formatDateTime(item.time)
    }));
}

/* ================= LAST MEMORY EVENT ================= */

/**
 * Last episodic memory event (true human-like "last thing")
 */
function lastMemoryEvent() {
  const recent = episodicMemory.getRecent(1);
  if (!recent || !recent.length) return null;

  const ep = recent[0];

  return {
    type: ep.type,
    subject: ep.subject,
    key: ep.key || null,
    value: ep.value || null,
    source: ep.source || "user",
    rememberedOn: formatDateTime(ep.timestamp)
  };
}

/* ================= EXPORTS ================= */

module.exports = {
  getSubjectMemory,
  getMemoryTimeline,
  lastMemoryEvent
};









// /**
//  * Memory Inspector
//  * Read-only analysis of Arvsal's memory
//  * NEVER writes memory
//  */

// const memory = require("./memory");
// const episodicMemory = require("./episodicMemory");


// /* ================= UTIL ================= */

// function formatDateTime(ts) {
//   if (!ts) return "Unknown";
//   const d = new Date(ts);
//   return `${d.toDateString()} ${d.toLocaleTimeString()}`;
// }


// /* ================= SUBJECT MEMORY ================= */

// /**
//  * Returns semantic memory for a subject
//  * Human-accurate: uses createdAt (when told), not updatedAt
//  */
// function getSubjectMemory(subject = "user") {
//   const facts = memory.summarize(subject);

//   return facts.map(f => ({
//     type: "semantic",
//     key: f.key,
//     value: f.value,
//     confidence: Number(f.confidence.toFixed(2)),
//     source: f.source,               // explicit | inferred
//     category: f.category,
//     rememberedOn: formatDateTime(f.createdAt),
//     lastRecalledOn: formatDateTime(f.updatedAt)
//   }));
// }


// /* ================= MEMORY TIMELINE ================= */

// /**
//  * Unified timeline of semantic + episodic memory
//  * Ordered by actual occurrence time
//  */
// function getMemoryTimeline(subject = "user", limit = 10) {
//   const semantic = memory
//     .summarize(subject)
//     .map(f => ({
//       type: "semantic",
//       key: f.key,
//       value: f.value,
//       source: f.source,
//       time: f.createdAt   // 🔒 when it was told
//     }));

//   const episodic = episodicMemory
//     .getBySubject(subject, limit)
//     .map(e => ({
//       type: "episodic",
//       key: e.key || null,
//       value: e.value || null,
//       source: e.source || "user",
//       time: e.timestamp
//     }));

//   return [...semantic, ...episodic]
//     .sort((a, b) => b.time - a.time)
//     .slice(0, limit)
//     .map(item => ({
//       type: item.type,
//       key: item.key,
//       value: item.value,
//       source: item.source,
//       rememberedOn: formatDateTime(item.time)
//     }));
// }


// /* ================= LAST MEMORY EVENT ================= */

// /**
//  * Last episodic memory event (true human-like "last thing")
//  */
// function lastMemoryEvent() {
//   const recent = episodicMemory.getRecent(1);
//   if (!recent || !recent.length) return null;

//   const ep = recent[0];

//   return {
//     type: ep.type,
//     subject: ep.subject,
//     key: ep.key || null,
//     value: ep.value || null,
//     source: ep.source || "user",
//     rememberedOn: formatDateTime(ep.timestamp)
//   };
// }


// /* ================= EXPORTS ================= */

// module.exports = {
//   getSubjectMemory,
//   getMemoryTimeline,
//   lastMemoryEvent
// };












