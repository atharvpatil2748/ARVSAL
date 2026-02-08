/**
 * Episodic Memory
 *
 * Human-like memory of events across time.
 * Deterministic, audit-safe.
 * ✅ FIXED: guaranteed persistence
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "episodic_memory.json");

/* ================= CONFIG ================= */

const { scoreImportance } = require("./importanceScorer");

const MAX_EPISODES = 500;

const LOW_IMPORTANCE_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days
const EPISODE_TTL = 30 * 24 * 60 * 60 * 1000;        // 30 days

/* ================= SESSION ================= */

function getSessionId() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const SESSION_ID = getSessionId();

/* ================= LOAD ================= */

let episodes = [];

function load() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify([], null, 2));
    }
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    episodes = Array.isArray(raw) ? raw : [];
  } catch {
    episodes = [];
  }
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(episodes, null, 2));
  } catch {
    // absolute fail-safe
  }
}

load();

/* ================= TIME HELPERS ================= */

function getWeek(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
}

function timeKeys(ts) {
  const d = new Date(ts);
  return {
    dayKey: d.toISOString().slice(0, 10),
    weekKey: `${d.getFullYear()}-W${getWeek(d)}`,
    monthKey: `${d.getFullYear()}-${d.getMonth() + 1}`
  };
}

/* ================= CLEANUP ================= */

function cleanup() {
  const now = Date.now();

  episodes = episodes.filter(ep => {
    if (!ep) return false;

    // Important memories live indefinitely
    if (typeof ep.importance === "number" && ep.importance >= 0.7) return true;

    if (!ep.expiresAt) return true;

    return ep.expiresAt > now;
  });

  if (episodes.length > MAX_EPISODES) {
    episodes = episodes.slice(-MAX_EPISODES);
  }

  save();
}

/* ================= STORE ================= */

async function store({
  type = "conversation",
  subject = "user",
  key = null,
  value = null,
  source = "user",
  importance = 0.4,
  meta = null
}) {
  if (!type) return;
  if (typeof value !== "string" || value.trim().length < 5) return;

  subject = String(subject || "user").toLowerCase().trim() || "user";

  // 🚫 Skip confirmation noise
  if (
    type === "response" &&
    /^(okay, (confirmed|cancelled)|please say yes or no\.?)$/i.test(value.trim())
  ) {
    return;
  }

  // Normalize importance
  if (type === "explicit_memory") importance = 1;
  else if (type === "forget") importance = 0.8;
  else if (type === "response") importance = 0.5;

  if (typeof scoreImportance === "function") {
    try {
      importance = Math.max(
        importance,
        scoreImportance({ type, subject, key, value, source })
      );
    } catch {}
  }

  const ts = Date.now();
  const { dayKey, weekKey, monthKey } = timeKeys(ts);

  const ttl =
    importance < 0.5
      ? LOW_IMPORTANCE_TTL
      : EPISODE_TTL;

  const episode = {
    type,
    subject,
    key: key ? String(key).toLowerCase().trim() : null,
    value: value.trim(),
    source,
    importance,
    meta,
    sessionId: SESSION_ID,
    timestamp: ts,
    dayKey,
    weekKey,
    monthKey,
    expiresAt:
      (type === "conversation" || type === "response")
        ? ts + ttl
        : null
  };

  /* ===== VECTOR RAG INDEX (SELECTIVE) ===== */

const { embedText } = require("./embeddingModel");
const { addVector } = require("./vectorStore");

if (
  importance >= 0.7 &&
  typeof value === "string" &&
  value.length >= 10 &&
  type !== "response" &&
  type !== "system"
) {
  embedText(value).then(embedding => {
    if (embedding) {
      addVector({
        embedding,
        text: value,
        subject,
        importance,
        timestamp: ts
      });
    }
  });
}

  episodes.push(episode);
  cleanup();

}

/* ================= RETRIEVE ================= */

function getByDay(dayKey) {
  cleanup();
  return episodes.filter(e => e.dayKey === dayKey);
}

function getByWeek(weekKey) {
  cleanup();
  return episodes.filter(e => e.weekKey === weekKey);
}

function getByMonth(monthKey) {
  cleanup();
  return episodes.filter(e => e.monthKey === monthKey);
}

function getBySubject(subject, limit = 10) {
  if (!subject) return [];
  cleanup();
  return episodes
    .filter(e => e.subject === subject.toLowerCase())
    .slice(-limit)
    .reverse();
}

function getRecent(limit = 10) {
  cleanup();
  return episodes.slice(-limit).reverse();
}

function getByDateRange(startTs, endTs) {
  cleanup();
  return episodes.filter(
    e => e.timestamp >= startTs && e.timestamp <= endTs
  );
}

function countSimilar({ subject, key, minImportance = 0.7 }) {
  if (!subject || !key) return 0;
  cleanup();
  return episodes.filter(
    e =>
      e.subject === subject &&
      e.key === key &&
      typeof e.importance === "number" &&
      e.importance >= minImportance
  ).length;
}

/* ================= FORGET ================= */

function forgetBySubject(subject) {
  if (!subject) return;
  subject = subject.toLowerCase();
  episodes = episodes.filter(e => e.subject !== subject);
  save();
}

function forgetAll() {
  episodes = [];
  save();
}

/* ================= EXPORT ================= */

module.exports = {
  store,
  getRecent,
  getByDay,
  getByWeek,
  getByMonth,
  getByDateRange,
  getBySubject,
  forgetBySubject,
  forgetAll,
  countSimilar
};
















// /**
//  * Episodic Memory
//  *
//  * Stores temporal conversation events (human-like memory of moments).
//  * Independent from semantic memory.
//  * Audit-safe and deterministic.
//  */

// const fs = require("fs");
// const path = require("path");

// const EPISODIC_FILE = path.join(__dirname, "episodic_memory.json");

// /* ================= CONFIG ================= */

// const MAX_EPISODES = 200;
// const EPISODE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// // Stable per-runtime session ID
// const SESSION_ID = Date.now().toString(36);

// /* ================= LOAD ================= */

// let episodes = [];

// if (fs.existsSync(EPISODIC_FILE)) {
//   try {
//     const raw = JSON.parse(fs.readFileSync(EPISODIC_FILE, "utf8"));
//     if (Array.isArray(raw)) episodes = raw;
//   } catch {
//     episodes = [];
//     save();
//   }
// }

// /* ================= SAVE ================= */

// function save() {
//   fs.writeFileSync(EPISODIC_FILE, JSON.stringify(episodes, null, 2));
// }

// /* ================= CLEANUP ================= */

// function cleanup() {
//   const now = Date.now();

//   episodes = episodes.filter(ep => {
//     if (ep.type === "explicit_memory") return true;
//     if (ep.type === "forget") return true;
//     if (!ep.expiresAt) return true;
//     return ep.expiresAt > now;
//   });

//   if (episodes.length > MAX_EPISODES) {
//     episodes = episodes.slice(-MAX_EPISODES);
//   }

//   // 🔒 IMPORTANT: persist cleanup
//   save();
// }

// /* ================= STORE ================= */

// function store({
//   type = "conversation",
//   subject = "user",
//   key = null,
//   value = null,
//   source = "user",
//   confidence = 1,
//   meta = null
// }) {
//   if (!type) return;

//   subject = String(subject || "user").toLowerCase().trim();
//   if (!subject) subject = "user";

//   if (type === "conversation" && (!value || value.length < 2)) return;

//   const episode = {
//     type,
//     subject,
//     key: key ? String(key).toLowerCase().trim() : null,
//     value: value ? String(value).trim() : null,
//     source,
//     confidence,
//     meta,
//     sessionId: SESSION_ID,
//     timestamp: Date.now(),
//     expiresAt:
//       type === "conversation" || type === "response"
//         ? Date.now() + EPISODE_TTL
//         : null
//   };

//   episodes.push(episode);
//   cleanup();
// }

// /* ================= RETRIEVE ================= */

// function getRecent(limit = 5) {
//   cleanup();
//   return episodes.slice(-limit).reverse();
// }

// function getByType(type, limit = 5) {
//   cleanup();
//   return episodes.filter(e => e.type === type).slice(-limit).reverse();
// }

// function getBySubject(subject, limit = 5) {
//   subject = String(subject || "").toLowerCase();
//   cleanup();
//   return episodes.filter(e => e.subject === subject).slice(-limit).reverse();
// }

// /* ================= DATE RANGE ================= */

// function getByDateRange(startTs, endTs, filter = {}) {
//   cleanup();

//   return episodes.filter(e => {
//     if (e.timestamp < startTs || e.timestamp > endTs) return false;
//     if (filter.type && e.type !== filter.type) return false;
//     if (filter.subject && e.subject !== filter.subject) return false;
//     if (filter.source && e.source !== filter.source) return false;
//     return true;
//   });
// }

// /* ================= EXPLICIT LOOKUP ================= */

// function findLastExplicit(subject, key) {
//   if (!subject || !key) return null;

//   subject = subject.toLowerCase();
//   key = key.toLowerCase();

//   cleanup();

//   for (let i = episodes.length - 1; i >= 0; i--) {
//     const ep = episodes[i];
//     if (
//       ep.type === "explicit_memory" &&
//       ep.source === "user" &&
//       ep.subject === subject &&
//       ep.key === key
//     ) {
//       return ep;
//     }
//   }

//   return null;
// }

// /* ================= FORGET ================= */

// function forgetBySubject(subject) {
//   subject = String(subject || "").toLowerCase();
//   episodes = episodes.filter(
//     ep => ep.subject !== subject || ep.type !== "conversation"
//   );
//   save();
// }

// function forgetAll({ force = false } = {}) {
//   if (force) {
//     episodes = [];
//   } else {
//     episodes = episodes.filter(
//       ep => ep.type === "explicit_memory" || ep.type === "forget"
//     );
//   }
//   save();
// }

// /* ================= TIMELINE ================= */

// function getTimeline(limit = 20) {
//   cleanup();
//   return episodes.slice(-limit).reverse().map(ep => ({
//     type: ep.type,
//     subject: ep.subject,
//     key: ep.key,
//     value: ep.value,
//     when: new Date(ep.timestamp).toISOString(),
//     source: ep.source,
//     sessionId: ep.sessionId
//   }));
// }

// /* ================= EXPORTS ================= */

// module.exports = {
//   store,
//   getRecent,
//   getByType,
//   getBySubject,
//   getByDateRange,
//   getTimeline,
//   findLastExplicit,
//   forgetBySubject,
//   forgetAll
// };








