/**
 * LLM Intent Router (SANDBOXED + FAIL-SAFE)
 *
 * - Local-only
 * - Single-shot
 * - Never executes actions
 * - Never generates replies
 * - Never overrides deterministic intent
 */

const { runLLM } = require("./llmRunner");
const { buildIntentPrompt } = require("./intentPrompt");

/* ================= CONFIG ================= */

const MODEL = "phi3:mini";
const TIMEOUT_MS = 1200;

const BASE_CONFIDENCE = 0.65;
const CONTROL_CONFIDENCE = 0.85;

/* ================= ALLOWED ================= */

const ALLOWED_INTENTS = new Set([
  "GENERAL_QUESTION",
  "INTRODUCE_SELF",
  "SEARCH",
  "YOUTUBE",
  "CONNECT_CHATGPT",
  "CONNECT_GEMINI",
  "DISCONNECT_AI"
]);

/* ================= FORBIDDEN ================= */

const FORBIDDEN_LLM_INTENTS = new Set([
  "SMALLTALK",
  "REMEMBER",
  "FORGET",
  "FORGET_ALL",
  "RECALL",
  "MEMORY_SUMMARY",
  "DAY_RECALL",
  "EPISODIC_RECALL",
  "EPISODIC_BY_DATE",
  "OPEN_APP",
  "OPEN_FOLDER",
  "OPEN_CALENDAR",
  "SHUTDOWN",
  "RESTART",
  "LOCK",
  "SLEEP",
  "MUTE",
  "VOLUME_UP",
  "VOLUME_DOWN"
]);

/* ================= SAFE JSON ================= */

function safeParseJSON(text) {
  try {
    if (!text || typeof text !== "string") return null;
    if (text.length < 10) return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/* ================= MAIN ================= */

async function resolveIntentWithLLM(rawText, deterministicIntent = null) {
  if (!rawText || rawText.length < 4) return null;

  const trimmed = rawText.trim().toLowerCase();

  /* ⛔ Explicit modes — NEVER routed */
  if (
    trimmed.startsWith("coding time") ||
    trimmed.startsWith("maths time")
  ) {
    return null;
  }

  /* ⛔ Deterministic intent ALWAYS wins */
  if (deterministicIntent && deterministicIntent !== "GENERAL_QUESTION") {
    return null;
  }

  /* ⛔ Hard imperatives */
  if (
    /^(open|remember|forget|lock|shutdown|restart|mute|volume)\b/i.test(trimmed)
  ) {
    return null;
  }

  /* ⛔ Short / trivial text */
  if (/^(hi|hello|hey|ok|okay)$/i.test(trimmed)) {
    return null;
  }

  const prompt = buildIntentPrompt(rawText);

  let response;
  try {
    response = await runLLM({
      model: MODEL,
      prompt,
      timeout: TIMEOUT_MS
    });
  } catch {
    return null;
  }

  if (!response) return null;

  const parsed = safeParseJSON(response);
  if (!parsed) return null;

  let { intent, confidence } = parsed;

  /* ================= VALIDATION ================= */

  if (intent === "SMALLTALK") {
    intent = "GENERAL_QUESTION";
  }

  if (!ALLOWED_INTENTS.has(intent)) return null;
  if (FORBIDDEN_LLM_INTENTS.has(intent)) return null;

  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    return null;
  }

  const requiredConfidence =
    intent.startsWith("CONNECT") || intent === "DISCONNECT_AI"
      ? CONTROL_CONFIDENCE
      : BASE_CONFIDENCE;

  if (confidence < requiredConfidence) {
    return null;
  }

  /* ================= SAFE CONSTRUCTION ================= */

  const intentObj = {
    intent,
    rawText,
    llm: true,
    confidence
  };

  if (intent === "SEARCH" && typeof parsed.query === "string") {
    intentObj.query = parsed.query.trim();
  }

  if (intent === "YOUTUBE" && typeof parsed.query === "string") {
    intentObj.query = parsed.query.trim();
  }

  if (
    intent === "LOCAL_SKILL" &&
    typeof parsed.skill === "string" &&
    ["TIME", "DATE"].includes(parsed.skill.toUpperCase())
  ) {
    intentObj.skill = parsed.skill.toUpperCase();
  }

  return intentObj;
}

module.exports = {
  resolveIntentWithLLM
};






// /**
//  * LLM Intent Router
//  *
//  * Uses local LLM ONLY to map fuzzy / polite input
//  * into EXISTING deterministic intents.
//  *
//  * NEVER executes actions.
//  * NEVER generates replies.
//  */

// const { execSync } = require("child_process");
// const { buildIntentPrompt } = require("./intentPrompt");

// const MODEL = "phi3:mini";
// const CONFIDENCE_THRESHOLD = 0.6;

// // Whitelist for safety
// const ALLOWED_INTENTS = new Set([
//   "SMALLTALK",
//   "GENERAL_QUESTION",
//   "CONFIRM_YES",
//   "CONFIRM_NO",
//   "INTRODUCE_SELF",
//   "LOCAL_SKILL",
//   "DAY_RECALL",
//   "EPISODIC_RECALL",
//   "EPISODIC_BY_DATE",
//   "MEMORY_SUMMARY",
//   "REMEMBER",
//   "FORGET",
//   "SEARCH",
//   "YOUTUBE",
//   "OPEN_APP",
//   "OPEN_FOLDER",
//   "OPEN_CALENDAR",
//   "SHUTDOWN",
//   "RESTART",
//   "LOCK",
//   "SLEEP",
//   "MUTE",
//   "VOLUME_UP",
//   "VOLUME_DOWN"
// ]);

// function runOllama(prompt) {
//   try {
//     return execSync(`ollama run ${MODEL}`, {
//       input: prompt,
//       encoding: "utf8",
//       timeout: 2000
//     }).trim();
//   } catch {
//     return null;
//   }
// }

// function safeParseJSON(text) {
//   try {
//     const match = text.match(/\{[\s\S]*\}/);
//     return match ? JSON.parse(match[0]) : null;
//   } catch {
//     return null;
//   }
// }

// function resolveIntentWithLLM(rawText) {
//   if (!rawText || rawText.length < 2) return null;

//   const prompt = buildIntentPrompt(rawText);
//   const response = runOllama(prompt);
//   if (!response) return null;

//   const parsed = safeParseJSON(response);
//   if (!parsed) return null;

//   const { intent, confidence } = parsed;

//   if (
//     !ALLOWED_INTENTS.has(intent) ||
//     typeof confidence !== "number" ||
//     confidence < CONFIDENCE_THRESHOLD
//   ) {
//     return null;
//   }

//   // 🔒 Normalize executable fields
//   const intentObj = {
//     intent,
//     rawText,
//     llm: true,
//     confidence
//   };

//   // Attach parameters safely
//   if (intent === "OPEN_APP" && parsed.app) {
//     intentObj.app = parsed.app.toLowerCase();
//   }

//   if (intent === "OPEN_FOLDER" && parsed.path) {
//     intentObj.path = parsed.path;
//   }

//   if (intent === "SEARCH" && parsed.query) {
//     intentObj.query = parsed.query;
//   }

//   if (intent === "YOUTUBE" && parsed.query) {
//     intentObj.query = parsed.query;
//   }

//   if (intent === "LOCAL_SKILL" && parsed.skill) {
//     intentObj.skill = parsed.skill.toUpperCase();
//   }

//   return intentObj;
// }

// module.exports = {
//   resolveIntentWithLLM
// };