/**
 * Action Intent Detector — 3-Tier Classifier
 *
 * Determines if user input is:
 *   "chat"          — pure conversation, no screen needed
 *   "screen_action" — requires screen capture + action
 *   "mixed"         — both chat and screen action
 *
 * Deterministic + Fast (no LLM, no network)
 * Backward compatible: isActionIntent() preserved for existing callers
 */

/* ================= SCREEN ACTION PATTERNS ================= */

// High-confidence screen action triggers
const SCREEN_ACTION_PATTERNS = [
  // Direct element actions
  /\bclick (the |on |this )?\w/i,
  /\btype (in|into|on|this|the|here|something)/i,
  /\btype \w.{0,20}(in|into|on) (the |a |this )?\w/i,   // "type hello in the search bar"
  /\btype ".+"/i,
  /\bscroll (up|down|left|right)\b/i,
  /\bpress (enter|tab|escape|backspace|space|ctrl|alt)/i,
  /\bpress the \w+ (button|key)\b/i,
  /\bclose (this |the |current )?tab\b/i,
  /\bopen (a |new )?tab\b/i,

  // Screen awareness
  /\bwhat('?s| is) on (my |the )?screen\b/i,
  /\bwhat do you see\b/i,
  /\blook at (my |the )?screen\b/i,
  /\banalyze (my )?screen\b/i,
  /\bsee (my )?screen\b/i,
  /\bread (my |the )?screen\b/i,
  /\bwhat('?s| is) (open|visible|showing|on screen)\b/i,
  /\bwhat (apps|windows|tabs) (are )?(open|running|visible)\b/i,
  /^what is (open|visible|showing)$/i,     // short form: "what is open"

  // Typing / form actions
  /\bfill (this|the|my|in|out)\b/i,
  /\benter (my |the |this )?(name|email|phone|password|text|details|info)\b/i,
  /\bsend (this )?message\b/i,
  /\bsend (a |the )?reply\b/i,

  // Suggestions (still screen-driven)
  /\bsuggest (a |some |the )?(reply|response|message|text|content|something)\b/i,
  /\bwrite something (for|here|in)\b/i,
  /\bimprove this (text|message|email)\b/i,
  /\btake (a )?screenshot\b/i,

  // Scroll & navigation
  /\bscroll (the )?(page|list|chat|window)\b/i,
  /\bgo (back|forward|up|down) (on|in|the)? (page|screen)\b/i,

  // Submit / confirm on screen
  /\bhit (the )?(send|submit|enter|ok|confirm) button\b/i,
  /\bsubmit (the |this )?(form|button)\b/i
];

// Phrases that explicitly combine chat + action
const MIXED_PATTERNS = [
  /explain .+and (then )?(click|type|scroll|press|close|open)\b/i,
  /tell me .+and (also )?(do|perform|execute|click|type)\b/i,
  /describe .+then (click|type|scroll|close)\b/i,
  /what .+(and|then|also) (click|type|scroll|send)\b/i
];

// Strong conversation markers — these override action patterns
const PURE_CHAT_OVERRIDES = [
  /^(hi|hello|hey|sup|yo|howdy)[\s!.?]*$/i,
  /^how (are|r) (you|u)\b/i,
  /^what (do you|can you) (think|feel|know) about\b/i,
  /^(explain|tell me about|what is|what are|how does|why does)\b(?!.*(screen|button|click|type|scroll|open|visible|showing|running|on screen))/i,
  /^(i think|i feel|i was thinking|just asking)\b/i,
  /^(thanks|thank you|ok|okay|cool|nice|great)\b/i
];

/* ================= OLD ACTION VERBS (preserved for isActionIntent compat) ================= */

const ACTION_PATTERNS = [
  /^open\s/i, /^close\s/i, /^start\s/i, /^launch\s/i, /^run\s/i,
  /^send\s/i, /^click\s/i, /^search\s/i, /^delete\s/i,
  /^shutdown\s/i, /^shut down\s/i, /^restart\s/i,
  /^login\s/i, /^log in\s/i, /^go to\s/i, /^type\s/i, /^press\s/i
];

const STRONG_ACTION_VERBS = [
  "open", "launch", "start", "run", "execute", "delete",
  "click", "send", "search", "shutdown", "restart", "lock", "close", "shut down"
];

/* ================= 3-TIER CLASSIFIER ================= */

/**
 * Classify user input into chat, screen_action, or mixed.
 *
 * @param {string} text
 * @returns {{ type: "chat"|"screen_action"|"mixed" }}
 */
function classifyScreenIntent(text = "") {
  if (!text || typeof text !== "string") return { type: "chat" };

  const trimmed = text.trim();

  // 1. Check pure chat overrides first
  for (const pattern of PURE_CHAT_OVERRIDES) {
    if (pattern.test(trimmed)) return { type: "chat" };
  }

  // 2. Check mixed patterns
  for (const pattern of MIXED_PATTERNS) {
    if (pattern.test(trimmed)) return { type: "mixed" };
  }

  // 3. Check screen action patterns
  for (const pattern of SCREEN_ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return { type: "screen_action" };
  }

  // 4. Default to chat
  return { type: "chat" };
}

/* ================= BACKWARD COMPAT: isActionIntent ================= */

/**
 * Legacy binary classifier — preserved so existing callers don't break.
 * Returns true if input appears to be an executable action.
 */
function isActionIntent(text = "") {
  if (!text || typeof text !== "string") return false;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  if (STRONG_ACTION_VERBS.includes(lower)) return true;

  const containsVerb = STRONG_ACTION_VERBS.some(v => lower.includes(v));
  if (containsVerb && !lower.includes("i think")) return true;

  // Also return true for screen actions
  const screenType = classifyScreenIntent(trimmed).type;
  return screenType === "screen_action" || screenType === "mixed";
}

/* ================= EXPORT ================= */

module.exports = {
  classifyScreenIntent,
  isActionIntent       // backward compat
};