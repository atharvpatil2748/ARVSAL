/**
 * Active Topic Tracker
 *
 * Keeps track of the current subject of conversation
 * Human-like, stable, and intent-aware
 */

let activeTopic = null;

const TOPIC_TTL = 10 * 60 * 1000; // 10 minutes


// Words that should NEVER become topics
const INVALID_TOPICS = new Set([
  "it", "that", "this",
  "time", "date", "sleep",
  "open", "close", "yes", "no",
  "okay", "ok", "confirm", "cancel",
  "user", "arvsal"
]);


// Intents that should NEVER affect topic
const NON_TOPIC_INTENTS = new Set([
  "OPEN_APP",
  "OPEN_FOLDER",
  "LOCAL_SKILL",
  "CONFIRM_YES",
  "CONFIRM_NO",
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


/* ================= VALIDATION ================= */

function normalizeSubject(subject) {
  if (typeof subject !== "string") return null;
  return subject.toLowerCase().trim();
}

function isValidTopic(subject) {
  const clean = normalizeSubject(subject);
  if (!clean) return false;

  if (clean.length < 3) return false;
  if (INVALID_TOPICS.has(clean)) return false;

  // Reject numeric or garbage tokens
  if (/^\d+$/.test(clean)) return false;
  if (!/^[a-z][a-z\s-]*$/.test(clean)) return false;

  return true;
}


/* ================= SET ================= */

/**
 * Set active topic ONLY when meaningful
 */
function setActiveTopic(subject, intent = null) {
  const normalized = normalizeSubject(subject);
  if (!isValidTopic(normalized)) return;

  // ❌ Do not set topic for non-conversational intents
  if (intent && NON_TOPIC_INTENTS.has(intent)) return;

  const now = Date.now();

  // Initialize new topic
  if (!activeTopic || activeTopic.subject !== normalized) {
    activeTopic = {
      subject: normalized,
      confidence: 1,
      updatedAt: now,
      lastIntent: intent || null
    };
    return;
  }

  // Reinforce ONLY if conversational continuity exists
  if (intent && activeTopic.lastIntent && intent !== activeTopic.lastIntent) {
    // Intent class changed → do not reinforce
    activeTopic.lastIntent = intent;
    activeTopic.updatedAt = now;
    return;
  }

  activeTopic.confidence = Math.min(1, activeTopic.confidence + 0.1);
  activeTopic.updatedAt = now;
  activeTopic.lastIntent = intent || activeTopic.lastIntent;
}


/* ================= GET ================= */

/**
 * Get active topic if still valid
 * (NO mutation on read — human-like)
 */
function getActiveTopic() {
  if (!activeTopic) return null;

  const now = Date.now();

  // Time expiry
  if (now - activeTopic.updatedAt > TOPIC_TTL) {
    activeTopic = null;
    return null;
  }

  return activeTopic.subject;
}


/* ================= MAINTENANCE ================= */

/**
 * Explicit decay (call on user input, not reads)
 */
function decayTopic() {
  if (!activeTopic) return;

  activeTopic.confidence -= 0.05;
  if (activeTopic.confidence < 0.4) {
    activeTopic = null;
  }
}

/**
 * Clear topic explicitly
 */
function clearActiveTopic() {
  activeTopic = null;
}


module.exports = {
  setActiveTopic,
  getActiveTopic,
  clearActiveTopic,
  decayTopic
};










// /**
//  * Active Topic Tracker
//  * Keeps track of the current subject of conversation
//  * Human-like, stable, and intent-aware
//  */

// let activeTopic = null;

// const TOPIC_TTL = 10 * 60 * 1000; // 10 minutes

// // Words that should NEVER become topics
// const INVALID_TOPICS = new Set([
//   "it", "that", "this",
//   "time", "date", "sleep",
//   "open", "close", "yes", "no",
//   "okay", "ok", "confirm", "cancel",
//   "user", "arvsal"
// ]);

// // Intents that should NEVER affect topic
// const NON_TOPIC_INTENTS = new Set([
//   "OPEN_APP",
//   "OPEN_FOLDER",
//   "LOCAL_SKILL",
//   "CONFIRM_YES",
//   "CONFIRM_NO",
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

// /**
//  * Validate topic candidate strictly
//  */
// function isValidTopic(subject) {
//   if (typeof subject !== "string") return false;

//   const clean = subject.toLowerCase().trim();

//   if (!clean || clean.length < 3) return false;
//   if (INVALID_TOPICS.has(clean)) return false;

//   // Reject numeric / garbage tokens
//   if (/^\d+$/.test(clean)) return false;
//   if (!/^[a-z][a-z\s-]*$/.test(clean)) return false;

//   return true;
// }

// /**
//  * Set active topic ONLY when meaningful
//  */
// function setActiveTopic(subject, intent = null) {
//   if (!isValidTopic(subject)) return;

//   // ❌ Do not set topic for non-conversational intents
//   if (intent && NON_TOPIC_INTENTS.has(intent)) {
//     return;
//   }

//   const now = Date.now();

//   // Initialize or reinforce
//   if (!activeTopic || activeTopic.subject !== subject) {
//     activeTopic = {
//       subject: subject.toLowerCase().trim(),
//       confidence: 1,
//       updatedAt: now
//     };
//     return;
//   }

//   // Reinforce confidence if same topic continues
//   activeTopic.confidence = Math.min(1, activeTopic.confidence + 0.1);
//   activeTopic.updatedAt = now;
// }

// /**
//  * Get active topic if still valid
//  * (NO refresh on read — human-like fading)
//  */
// function getActiveTopic() {
//   if (!activeTopic) return null;

//   const now = Date.now();

//   // Time expiry
//   if (now - activeTopic.updatedAt > TOPIC_TTL) {
//     activeTopic = null;
//     return null;
//   }

//   // Confidence decay
//   activeTopic.confidence -= 0.05;
//   if (activeTopic.confidence < 0.4) {
//     activeTopic = null;
//     return null;
//   }

//   return activeTopic.subject;
// }

// /**
//  * Clear topic explicitly
//  */
// function clearActiveTopic() {
//   activeTopic = null;
// }

// module.exports = {
//   setActiveTopic,
//   getActiveTopic,
//   clearActiveTopic
// };



