/**
 * Episodic Memory
 *
 * Stores temporal conversation events (human-like memory of moments).
 * Independent from semantic memory.
 * Audit-safe and deterministic.
 */

const fs = require("fs");
const path = require("path");

const EPISODIC_FILE = path.join(__dirname, "episodic_memory.json");

/* ================= CONFIG ================= */

const MAX_EPISODES = 200;
const EPISODE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Stable per-runtime session ID
const SESSION_ID = Date.now().toString(36);

/* ================= LOAD ================= */

let episodes = [];

if (fs.existsSync(EPISODIC_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(EPISODIC_FILE, "utf8"));
    if (Array.isArray(raw)) episodes = raw;
  } catch {
    episodes = [];
    save();
  }
}

/* ================= SAVE ================= */

function save() {
  fs.writeFileSync(EPISODIC_FILE, JSON.stringify(episodes, null, 2));
}

/* ================= CLEANUP ================= */

function cleanup() {
  const now = Date.now();

  episodes = episodes.filter(ep => {
    if (ep.type === "explicit_memory") return true;
    if (ep.type === "forget") return true;
    if (!ep.expiresAt) return true;
    return ep.expiresAt > now;
  });

  if (episodes.length > MAX_EPISODES) {
    episodes = episodes.slice(-MAX_EPISODES);
  }

  // 🔒 IMPORTANT: persist cleanup
  save();
}

/* ================= STORE ================= */

function store({
  type = "conversation",
  subject = "user",
  key = null,
  value = null,
  source = "user",
  confidence = 1,
  meta = null
}) {
  if (!type) return;

  subject = String(subject || "user").toLowerCase().trim();
  if (!subject) subject = "user";

  if (type === "conversation" && (!value || value.length < 2)) return;

  const episode = {
    type,
    subject,
    key: key ? String(key).toLowerCase().trim() : null,
    value: value ? String(value).trim() : null,
    source,
    confidence,
    meta,
    sessionId: SESSION_ID,
    timestamp: Date.now(),
    expiresAt:
      type === "conversation" || type === "response"
        ? Date.now() + EPISODE_TTL
        : null
  };

  episodes.push(episode);
  cleanup();
}

/* ================= RETRIEVE ================= */

function getRecent(limit = 5) {
  cleanup();
  return episodes.slice(-limit).reverse();
}

function getByType(type, limit = 5) {
  cleanup();
  return episodes.filter(e => e.type === type).slice(-limit).reverse();
}

function getBySubject(subject, limit = 5) {
  subject = String(subject || "").toLowerCase();
  cleanup();
  return episodes.filter(e => e.subject === subject).slice(-limit).reverse();
}

/* ================= DATE RANGE ================= */

function getByDateRange(startTs, endTs, filter = {}) {
  cleanup();

  return episodes.filter(e => {
    if (e.timestamp < startTs || e.timestamp > endTs) return false;
    if (filter.type && e.type !== filter.type) return false;
    if (filter.subject && e.subject !== filter.subject) return false;
    if (filter.source && e.source !== filter.source) return false;
    return true;
  });
}

/* ================= EXPLICIT LOOKUP ================= */

function findLastExplicit(subject, key) {
  if (!subject || !key) return null;

  subject = subject.toLowerCase();
  key = key.toLowerCase();

  cleanup();

  for (let i = episodes.length - 1; i >= 0; i--) {
    const ep = episodes[i];
    if (
      ep.type === "explicit_memory" &&
      ep.source === "user" &&
      ep.subject === subject &&
      ep.key === key
    ) {
      return ep;
    }
  }

  return null;
}

/* ================= FORGET ================= */

function forgetBySubject(subject) {
  subject = String(subject || "").toLowerCase();
  episodes = episodes.filter(
    ep => ep.subject !== subject || ep.type !== "conversation"
  );
  save();
}

function forgetAll({ force = false } = {}) {
  if (force) {
    episodes = [];
  } else {
    episodes = episodes.filter(
      ep => ep.type === "explicit_memory" || ep.type === "forget"
    );
  }
  save();
}

/* ================= TIMELINE ================= */

function getTimeline(limit = 20) {
  cleanup();
  return episodes.slice(-limit).reverse().map(ep => ({
    type: ep.type,
    subject: ep.subject,
    key: ep.key,
    value: ep.value,
    when: new Date(ep.timestamp).toISOString(),
    source: ep.source,
    sessionId: ep.sessionId
  }));
}

/* ================= EXPORTS ================= */

module.exports = {
  store,
  getRecent,
  getByType,
  getBySubject,
  getByDateRange,
  getTimeline,
  findLastExplicit,
  forgetBySubject,
  forgetAll
};


















// /**
//  * Episodic Memory
//  *
//  * Stores temporal conversation events (human-like memory of moments).
//  * Independent from semantic memory.
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

//   // 🚫 Prevent useless entries
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
//         : null // 🔒 explicit & forget never expire
//   };

//   episodes.push(episode);
//   cleanup();
//   save();
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

// /* ================= DAY RANGE ================= */

// function getByDateRange(startTs, endTs) {
//   cleanup();
//   return episodes.filter(
//     e => e.timestamp >= startTs && e.timestamp <= endTs
//   );
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

// // Only remove conversational noise, NOT audit trail
// function forgetBySubject(subject) {
//   subject = String(subject || "").toLowerCase();
//   episodes = episodes.filter(
//     ep => ep.subject !== subject || ep.type !== "conversation"
//   );
//   save();
// }

// function forgetAll() {
//   episodes = [];
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







