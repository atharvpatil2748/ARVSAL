/**
 * Action Intent Detector
 *
 * Determines if user input is:
 * - Conversational
 * - Executable (Agentic)
 *
 * Deterministic + Fast
 */

const ACTION_PATTERNS = [
  /^open\s/i,
  /^close\s/i,
  /^start\s/i,
  /^launch\s/i,
  /^run\s/i,
  /^send\s/i,
  /^click\s/i,
  /^search\s/i,
  /^delete\s/i,
  /^shutdown\s/i,
  /^shut down\s/i,
  /^restart\s/i,
  /^login\s/i,
  /^log in\s/i,
  /^go to\s/i,
  /^type\s/i,
  /^press\s/i
];

// More intelligent pattern
const STRONG_ACTION_VERBS = [
  "open",
  "launch",
  "start",
  "run",
  "execute",
  "delete",
  "click",
  "send",
  "search",
  "shutdown",
  "restart",
  "lock",
  "close",
  "shut down"
];

function isActionIntent(text = "") {
  if (!text || typeof text !== "string") return false;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1️⃣ Direct command start
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // 2️⃣ Single-word command (like: lock, shutdown)
  if (STRONG_ACTION_VERBS.includes(lower)) {
    return true;
  }

  // 3️⃣ Verb anywhere in sentence
  const containsVerb = STRONG_ACTION_VERBS.some(v =>
    lower.includes(v)
  );

  if (containsVerb && !lower.includes("i think")) {
    return true;
  }

  return false;
}

module.exports = {
  isActionIntent
};