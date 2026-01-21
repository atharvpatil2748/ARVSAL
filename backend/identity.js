/**
 * Identity Layer
 *
 * Defines Arvsal’s immutable core identity
 * and safe identity lookup for known subjects.
 *
 * This file MUST remain deterministic.
 */

const fs = require("fs");
const path = require("path");

const IDENTITY_FILE = path.join(__dirname, "identity.json");

/* ================= LOAD ================= */

let identity = {};

if (fs.existsSync(IDENTITY_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf8"));
    if (raw && typeof raw === "object") {
      identity = raw;
    }
  } catch {
    identity = {};
  }
}

/* ================= SAFE LOOKUP ================= */

/**
 * Get stored identity for a subject (if any)
 * This is NOT inferred memory.
 */
function getIdentity(subject) {
  if (!subject) return null;

  const key = String(subject).toLowerCase().trim();
  if (!key) return null;

  const value = identity[key];
  if (!value) return null;

  return {
    value,
    source: "explicit_identity",
    confidence: 1
  };
}

/* ================= CORE IDENTITY (IMMUTABLE) ================= */

const CORE_IDENTITY = Object.freeze({
  arvsal: Object.freeze({
    description:
      "I am Arvsal — an intelligent autonomous response and virtual system analysis layer created by Atharv. " +
      "I help you reason, remember, analyze context, and make decisions. " +
      "When you explicitly instruct me, I can also perform system actions and automation. " +
      "I never act independently or in the background.",
    version: "1.0",
    capabilities: Object.freeze([
      "conversation",
      "contextual memory",
      "analysis",
      "system actions (explicit only)"
    ]),
    source: "core_identity",
    confidence: 1
  })
});

/* ================= PUBLIC API ================= */

/**
 * Introduce Arvsal.
 * This must NEVER be rewritten, paraphrased, or explained further.
 */
function introduceSelf() {
  return CORE_IDENTITY.arvsal.description;
}

/**
 * Explain how Arvsal knows who it is.
 * Used ONLY when explicitly asked ("how do you know this?")
 */
function explainIdentitySource() {
  return "This is my core identity, defined at creation. It is not a learned or remembered fact.";
}

module.exports = {
  introduceSelf,
  getIdentity,
  explainIdentitySource
};





















// const fs = require("fs");
// const path = require("path");

// const IDENTITY_FILE = path.join(__dirname, "identity.json");

// const identity = JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf8"));

// function getIdentity(subject) {
//   return identity[subject] || null;
// }

// const CORE_IDENTITY = {
//   arvsal: {
//     description:
//       "I am Arvsal — an intelligent autonomous response and virtual system analysis layer created by Atharv. " +
//       "I help you reason, remember, analyze context, and make decisions. " +
//       "When you explicitly instruct me, I can also perform system actions and automation. " +
//       "I never act independently or in the background.",
//     version: "1.0",
//     capabilities: [
//       "conversation",
//       "contextual memory",
//       "analysis",
//       "system actions (explicit only)"
//     ]
//   }
// };

// function introduceSelf() {
//   return CORE_IDENTITY.arvsal.description;
// }

// module.exports = {
//   introduceSelf,
//   getIdentity
// };
