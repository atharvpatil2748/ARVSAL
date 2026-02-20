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
  "MUTE"
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

  const now = Date.now();
  const incomingIntent = data.intent || null;
  const incomingClass = intentClass(incomingIntent);

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
    incomingClass &&
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

  if (incomingIntent) {
    context.intent = incomingIntent;
    context.intentClass = incomingClass;
  }

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

  // 🔒 Gentle decay ONLY on explicit conversational usage
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


let confirmation = null;

function setConfirmation(data) {
  confirmation = data;
}

function getConfirmation() {
  return confirmation;
}

function clearConfirmation() {
  confirmation = null;
}

module.exports = {
  setContext,
  getContext,
  clearContext,
  peekContext,
  setConfirmation,
  getConfirmation,
  clearConfirmation,
};














// /**
//  * Context Memory
//  *
//  * Short-term conversational reference memory.
//  * NOT factual memory.
//  * NOT episodic memory.
//  * Deterministic and decay-safe.
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

//   if (intent === "REMEMBER") return "write";
//   if (intent === "RECALL") return "read";
//   if (intent === "FORGET") return "forget";

//   return "conversation";
// }

// /* ================= SET CONTEXT ================= */

// function setContext(data = {}) {
//   if (!data || typeof data !== "object") return;
//   if (!data.intent) return;

//   const now = Date.now();
//   const incomingClass = intentClass(data.intent);

//   // 🚫 System intents never touch context
//   if (incomingClass === "system") return;

//   // 🔥 FORGET is a hard boundary
//   if (incomingClass === "forget") {
//     context = null;
//     return;
//   }

//   // Init or expire
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

//   // Reset on intent-class change (except read ↔ write)
//   if (
//     context.intentClass &&
//     incomingClass !== context.intentClass &&
//     !(
//       (incomingClass === "read" && context.intentClass === "write") ||
//       (incomingClass === "write" && context.intentClass === "read")
//     )
//   ) {
//     context = {
//       subject: null,
//       key: null,
//       intent: null,
//       intentClass: null,
//       confidence: 1,
//       timestamp: now
//     };
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

//   context.intent = data.intent;
//   context.intentClass = incomingClass;
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

//   // 🔒 Gentle decay (only on real usage)
//   if (use === true) {
//     context.confidence = Math.max(0, context.confidence - 0.1);
//   }

//   if (context.confidence < 0.35) {
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











