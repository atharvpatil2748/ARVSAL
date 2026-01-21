/**
 * Chat History (Temporary Conversation Buffer)
 *
 * IMPORTANT:
 * - This is NOT memory.
 * - This is NOT authoritative.
 * - Used ONLY for short-term conversational continuity.
 */

const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "chat_history.json");

// 🔒 HARD LIMITS
const MAX_MESSAGES = 50;
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

/* ================= LOAD ================= */

function loadHistory() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([]));
  }

  let history;
  try {
    history = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  return cleanup(history);
}

/* ================= CLEANUP ================= */

function cleanup(history) {
  const now = Date.now();

  // Remove old messages
  history = history.filter(
    msg => msg && msg.timestamp && now - msg.timestamp <= MAX_AGE_MS
  );

  // Enforce size limit
  if (history.length > MAX_MESSAGES) {
    history = history.slice(-MAX_MESSAGES);
  }

  return history;
}

/* ================= SAVE ================= */

function saveHistory(history) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));
}

/* ================= ADD ================= */

function addMessage(role, content) {
  if (!content || typeof content !== "string") return;

  const history = loadHistory();

  const timestamp = Date.now();

  history.push({
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`, // 🔒 UNIQUE
    role,
    content,
    text: content,
    timestamp
  });

  saveHistory(history);
}

/* ================= GET ================= */

function getHistory() {
  return loadHistory();
}

module.exports = {
  addMessage,
  getHistory
};














// /**
//  * Chat History (Temporary Conversation Buffer)
//  *
//  * IMPORTANT:
//  * - This is NOT memory.
//  * - This is NOT authoritative.
//  * - Used ONLY for short-term conversational continuity.
//  */

// const fs = require("fs");
// const path = require("path");

// const FILE_PATH = path.join(__dirname, "chat_history.json");

// // 🔒 HARD LIMITS (Electron-safe)
// const MAX_MESSAGES = 50;          // prevents context bleed
// const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours (session-like)

// /* ================= LOAD ================= */

// function loadHistory() {
//   if (!fs.existsSync(FILE_PATH)) {
//     fs.writeFileSync(FILE_PATH, JSON.stringify([]));
//   }

//   let history;
//   try {
//     history = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
//     if (!Array.isArray(history)) history = [];
//   } catch {
//     history = [];
//   }

//   return cleanup(history);
// }

// /* ================= CLEANUP ================= */

// function cleanup(history) {
//   const now = Date.now();

//   // ⏳ Remove old messages (session boundary)
//   history = history.filter(
//     msg => msg?.timestamp && now - msg.timestamp <= MAX_AGE_MS
//   );

//   // 🧹 Enforce size limit
//   if (history.length > MAX_MESSAGES) {
//     history = history.slice(-MAX_MESSAGES);
//   }

//   return history;
// }

// /* ================= SAVE ================= */

// function saveHistory(history) {
//   fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));
// }

// /* ================= ADD ================= */

// function addMessage(role, content) {
//   if (!content || typeof content !== "string") return;

//   const history = loadHistory();

//   history.push({
//     id: Date.now(),                // monotonic enough for ordering
//     role,
//     content,                       // backend / LLM / context
//     text: content,                 // frontend compatibility
//     timestamp: Date.now()          // numeric for computation
//   });

//   saveHistory(history);
// }

// /* ================= GET ================= */

// function getHistory() {
//   return loadHistory();
// }

// module.exports = {
//   addMessage,
//   getHistory
// };













// const fs = require("fs");
// const path = require("path");

// const FILE_PATH = path.join(__dirname, "chat_history.json");

// function loadHistory() {
//   if (!fs.existsSync(FILE_PATH)) {
//     fs.writeFileSync(FILE_PATH, JSON.stringify([]));
//   }
//   return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
// }

// function addMessage(role, content) {
//   const history = loadHistory();

//   history.push({
//     role,
//     content,      // ✅ backend / LLM / context
//     text: content, // ✅ frontend compatibility
//     time: new Date().toISOString()
//   });

//   fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));
// }

// function getHistory() {
//   return loadHistory();
// }

// module.exports = {
//   addMessage,
//   getHistory
// };







