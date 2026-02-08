/**
 * Chat History (Short-term Conversation Buffer)
 *
 * - NOT semantic memory
 * - NOT episodic memory
 * - UI depends on this
 *
 * Design goals:
 * - Stable UI
 * - No silent wipes
 * - Clean LLM context
 */

const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "chat_history.json");

// 🔒 Limits
const MAX_MESSAGES = 100;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// 🔒 Allowed roles
const ALLOWED_ROLES = new Set(["user", "arvsal"]);

/* ================= UTIL ================= */

function ensureFile() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, "[]");
    }
  } catch {}
}

function safeRead() {
  try {
    ensureFile();
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeWrite(history) {
  try {
    const temp = FILE_PATH + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(history, null, 2));
    fs.renameSync(temp, FILE_PATH);
  } catch {}
}

/* ================= CLEANUP ================= */

function cleanup(history) {
  const now = Date.now();

  history = history.filter(m => {
    if (!m || typeof m !== "object") return false;
    if (!m.text || typeof m.text !== "string") return false;
    if (!m.timestamp) return true;
    return now - m.timestamp <= MAX_AGE_MS;
  });

  if (history.length > MAX_MESSAGES) {
    history = history.slice(-MAX_MESSAGES);
  }

  return history;
}

/* ================= LOAD ================= */

function loadHistory() {
  const history = cleanup(safeRead());
  safeWrite(history);
  return history;
}

/* ================= ADD ================= */

/**
 * addMessage(role, text, options?)
 *
 * options.internal === true
 * → message is NOT used for LLM context
 */
function addMessage(role, text, options = {}) {
  if (!ALLOWED_ROLES.has(role)) return;
  if (!text || typeof text !== "string") return;

  text = text.trim();
  if (!text) return;

  const history = loadHistory();
  const timestamp = Date.now();

  history.push({
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp,

    // 🧠 INTERNAL FLAG
    internal: options.internal === true
  });

  safeWrite(history);
}

/* ================= GET ================= */

/**
 * Full history (UI / debug)
 */
function getHistory() {
  return loadHistory();
}

/**
 * LLM-safe context only
 */
function getLLMContext(limit = 4) {
  return loadHistory()
    .filter(m => !m.internal)
    .slice(-limit);
}

module.exports = {
  addMessage,
  getHistory,
  getLLMContext
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

// // 🔒 HARD LIMITS
// const MAX_MESSAGES = 50;
// const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

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

//   // Remove old messages
//   history = history.filter(
//     msg => msg && msg.timestamp && now - msg.timestamp <= MAX_AGE_MS
//   );

//   // Enforce size limit
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

//   const timestamp = Date.now();

//   history.push({
//     id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`, // 🔒 UNIQUE
//     role,
//     content,
//     text: content,
//     timestamp
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




