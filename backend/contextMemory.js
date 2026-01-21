/**
 * Context Memory
 *
 * Short-term conversational reference memory.
 * NOT factual memory.
 * NOT episodic memory.
 * Deterministic and decay-safe.
 */

let context = null;

const CONTEXT_TTL = 2 * 60 * 1000; // 2 minutes

// Intents that must NEVER create conversational context
const SYSTEM_INTENTS = new Set([
  "LOCAL_SKILL",
  "OPEN_APP",
  "OPEN_FOLDER",
  "OPEN_CALENDAR",
  "SHUTDOWN",
  "RESTART",
  "SLEEP",
  "LOCK",
  "VOLUME_UP",
  "VOLUME_DOWN",
  "MUTE",
  "PLAY_PAUSE",
  "NEXT_TRACK",
  "PREV_TRACK"
]);

/* ================= INTENT CLASS ================= */

function intentClass(intent) {
  if (!intent) return "conversation";
  if (SYSTEM_INTENTS.has(intent)) return "system";

  if (intent === "REMEMBER") return "write";
  if (intent === "RECALL") return "read";
  if (intent === "FORGET") return "forget";

  return "conversation";
}

/* ================= SET CONTEXT ================= */

function setContext(data = {}) {
  if (!data || typeof data !== "object") return;
  if (!data.intent) return;

  const now = Date.now();
  const incomingClass = intentClass(data.intent);

  // 🚫 System intents never touch context
  if (incomingClass === "system") return;

  // 🔥 FORGET is a hard boundary
  if (incomingClass === "forget") {
    context = null;
    return;
  }

  // Init or expire
  if (!context || now - context.timestamp > CONTEXT_TTL) {
    context = {
      subject: null,
      key: null,
      intent: null,
      intentClass: null,
      confidence: 1,
      timestamp: now
    };
  }

  // Reset on intent-class change (except read ↔ write)
  if (
    context.intentClass &&
    incomingClass !== context.intentClass &&
    !(
      (incomingClass === "read" && context.intentClass === "write") ||
      (incomingClass === "write" && context.intentClass === "read")
    )
  ) {
    context = {
      subject: null,
      key: null,
      intent: null,
      intentClass: null,
      confidence: 1,
      timestamp: now
    };
  }

  // Subject change clears key
  if (
    typeof data.subject === "string" &&
    context.subject &&
    data.subject.toLowerCase() !== context.subject
  ) {
    context.key = null;
  }

  if (typeof data.subject === "string" && data.subject.trim()) {
    context.subject = data.subject.toLowerCase();
  }

  if (typeof data.key === "string" && data.key.trim()) {
    context.key = data.key.toLowerCase();
  }

  context.intent = data.intent;
  context.intentClass = incomingClass;
  context.timestamp = now;
}

/* ================= GET CONTEXT ================= */

function getContext({ use = true } = {}) {
  if (!context) return null;

  // Expired
  if (Date.now() - context.timestamp > CONTEXT_TTL) {
    context = null;
    return null;
  }

  // 🔒 Gentle decay (only on real usage)
  if (use === true) {
    context.confidence = Math.max(0, context.confidence - 0.1);
  }

  if (context.confidence < 0.35) {
    context = null;
    return null;
  }

  return { ...context };
}

/* ================= CLEAR ================= */

function clearContext() {
  context = null;
}

/* ================= DEBUG ================= */

function peekContext() {
  return context ? { ...context } : null;
}

module.exports = {
  setContext,
  getContext,
  clearContext,
  peekContext
};



















// /**
//  * Context Memory
//  *
//  * Short-term conversational reference memory.
//  * NOT factual memory.
//  * NOT episodic memory.
//  */

// let context = null;

// const CONTEXT_TTL = 2 * 60 * 1000; // 2 minutes

// // Intents that must NEVER create conversational context
// const SYSTEM_INTENTS = new Set([
//   "LOCAL_SKILL",
//   "OPEN_APP",
//   "OPEN_FOLDER",
//   "OPEN_CALENDAR",
//   "SHUTDOWN",
//   "RESTART",
//   "SLEEP",
//   "LOCK",
//   "VOLUME_UP",
//   "VOLUME_DOWN",
//   "MUTE",
//   "PLAY_PAUSE",
//   "NEXT_TRACK",
//   "PREV_TRACK"
// ]);

// /* ================= INTENT CLASS ================= */

// function intentClass(intent) {
//   if (!intent) return "conversation";
//   if (SYSTEM_INTENTS.has(intent)) return "system";
//   if (intent === "REMEMBER") return "memory";
//   if (intent === "RECALL") return "memory"; // 🔒 SAME CLASS
//   return "conversation";
// }

// /* ================= SET CONTEXT ================= */

// function setContext(data = {}) {
//   if (typeof data !== "object" || data === null) return;

//   const now = Date.now();

//   // Ignore system intents
//   if (SYSTEM_INTENTS.has(data.intent)) return;

//   // Initialize or reset expired context
//   if (!context || now - context.timestamp > CONTEXT_TTL) {
//     context = {
//       subject: null,
//       key: null,
//       intent: null,
//       intentClass: null,
//       confidence: 1,
//       timestamp: now
//     };
//   }

//   const incomingClass = intentClass(data.intent);

//   // Reset only if switching to SYSTEM
//   if (
//     context.intentClass &&
//     incomingClass !== context.intentClass &&
//     incomingClass === "system"
//   ) {
//     context = null;
//     return;
//   }

//   // Subject change clears key
//   if (
//     typeof data.subject === "string" &&
//     context.subject &&
//     data.subject.toLowerCase() !== context.subject
//   ) {
//     context.key = null;
//   }

//   if (typeof data.subject === "string" && data.subject.trim()) {
//     context.subject = data.subject.toLowerCase();
//   }

//   if (typeof data.key === "string" && data.key.trim()) {
//     context.key = data.key.toLowerCase();
//   }

//   if (data.intent) {
//     context.intent = data.intent;
//     context.intentClass = incomingClass;
//   }

//   context.timestamp = now;
// }

// /* ================= GET CONTEXT ================= */

// function getContext({ use = true } = {}) {
//   if (!context) return null;

//   // Expired
//   if (Date.now() - context.timestamp > CONTEXT_TTL) {
//     context = null;
//     return null;
//   }

//   // 🔒 Meta queries must not decay context
//   if (use === true) {
//     context.confidence = Math.max(0, context.confidence - 0.15);
//   }

//   if (context.confidence < 0.3) {
//     context = null;
//     return null;
//   }

//   return { ...context };
// }

// /* ================= CLEAR ================= */

// function clearContext() {
//   context = null;
// }

// /* ================= DEBUG ================= */

// function peekContext() {
//   return context ? { ...context } : null;
// }

// module.exports = {
//   setContext,
//   getContext,
//   clearContext,
//   peekContext
// };









// let context = null;

// const CONTEXT_TTL = 2 * 60 * 1000; // 2 minutes

// // Intents that must NEVER create conversational context
// const SYSTEM_INTENTS = new Set([
//   "LOCAL_SKILL",
//   "OPEN_APP",
//   "OPEN_FOLDER",
//   "OPEN_CALENDAR",
//   "SHUTDOWN",
//   "RESTART",
//   "SLEEP",
//   "LOCK",
//   "VOLUME_UP",
//   "VOLUME_DOWN",
//   "MUTE",
//   "PLAY_PAUSE",
//   "NEXT_TRACK",
//   "PREV_TRACK"
// ]);

// // Intent classes (coarse groups)
// function intentClass(intent) {
//   if (!intent) return "unknown";
//   if (SYSTEM_INTENTS.has(intent)) return "system";
//   if (intent === "REMEMBER" || intent === "MEMORY_SUMMARY") return "memory";
//   if (intent === "RECALL") return "recall";
//   return "conversation";
// }

// /**
//  * Set or update conversational context safely
//  */
// function setContext(data = {}) {
//   if (typeof data !== "object" || data === null) return;

//   // ❌ Ignore system-level context completely
//   if (data.intent && SYSTEM_INTENTS.has(data.intent)) return;

//   const now = Date.now();

//   // Initialize or reset expired context
//   if (!context || now - context.timestamp > CONTEXT_TTL) {
//     context = {
//       subject: null,
//       key: null,
//       topic: null,
//       intent: null,
//       intentClass: null,
//       reason: null,
//       confidence: 1,
//       timestamp: now
//     };
//   }

//   // 🔁 Reset if intent class changes fundamentally
//   if (
//     typeof data.intent === "string" &&
//     context.intentClass &&
//     intentClass(data.intent) !== context.intentClass
//   ) {
//     context = {
//       subject: null,
//       key: null,
//       topic: null,
//       intent: data.intent,
//       intentClass: intentClass(data.intent),
//       reason: data.reason || null,
//       confidence: 1,
//       timestamp: now
//     };
//     return;
//   }

//   // 🔄 Subject change → clear topic
//   if (
//     typeof data.subject === "string" &&
//     context.subject &&
//     data.subject.toLowerCase() !== context.subject
//   ) {
//     context.topic = null;
//   }

//   // Selective safe updates
//   if (typeof data.subject === "string" && data.subject.trim()) {
//     context.subject = data.subject.toLowerCase();
//   }

//   if (typeof data.key === "string" && data.key.trim()) {
//     context.key = data.key.toLowerCase();
//   }

//   if (typeof data.topic === "string" && data.topic.trim()) {
//     context.topic = data.topic.toLowerCase();
//   }

//   if (typeof data.intent === "string") {
//     context.intent = data.intent;
//     context.intentClass = intentClass(data.intent);
//   }

//   if (typeof data.reason === "string") {
//     context.reason = data.reason;
//   }

//   if (typeof data.confidence === "number") {
//     context.confidence = Math.max(0, Math.min(1, data.confidence));
//   }

//   context.timestamp = now;
// }

// /**
//  * Get valid context (confidence-aware)
//  * `use = true` means context is actually consumed
//  */
// function getContext({ use = true } = {}) {
//   if (!context) return null;

//   // ⏳ Expired
//   if (Date.now() - context.timestamp > CONTEXT_TTL) {
//     context = null;
//     return null;
//   }

//   // 🧠 Decay ONLY when actually used
//   if (use) {
//     context.confidence = Math.max(0, context.confidence - 0.05);
//   }

//   // 🔒 Too weak → discard
//   if (context.confidence < 0.4) {
//     context = null;
//     return null;
//   }

//   return { ...context };
// }

// /**
//  * Clear context manually
//  */
// function clearContext() {
//   context = null;
// }

// /**
//  * Debug helper (safe)
//  */
// function peekContext() {
//   return context ? { ...context } : null;
// }

// module.exports = {
//   setContext,
//   getContext,
//   clearContext,
//   peekContext
// };


