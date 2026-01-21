/**
 * LLM Intent Router
 *
 * Uses local LLM ONLY to map fuzzy / polite input
 * into EXISTING deterministic intents.
 *
 * NEVER executes actions.
 * NEVER generates replies.
 */

const { execSync } = require("child_process");
const { buildIntentPrompt } = require("./intentPrompt");

const MODEL = "phi3:mini";
const CONFIDENCE_THRESHOLD = 0.6;

// Whitelist for safety
const ALLOWED_INTENTS = new Set([
  "SMALLTALK",
  "GENERAL_QUESTION",
  "CONFIRM_YES",
  "CONFIRM_NO",
  "INTRODUCE_SELF",
  "LOCAL_SKILL",
  "DAY_RECALL",
  "EPISODIC_RECALL",
  "EPISODIC_BY_DATE",
  "MEMORY_SUMMARY",
  "REMEMBER",
  "FORGET",
  "SEARCH",
  "YOUTUBE",
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

function runOllama(prompt) {
  try {
    return execSync(`ollama run ${MODEL}`, {
      input: prompt,
      encoding: "utf8",
      timeout: 2000
    }).trim();
  } catch {
    return null;
  }
}

function safeParseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

function resolveIntentWithLLM(rawText) {
  if (!rawText || rawText.length < 2) return null;

  const prompt = buildIntentPrompt(rawText);
  const response = runOllama(prompt);
  if (!response) return null;

  const parsed = safeParseJSON(response);
  if (!parsed) return null;

  const { intent, confidence } = parsed;

  if (
    !ALLOWED_INTENTS.has(intent) ||
    typeof confidence !== "number" ||
    confidence < CONFIDENCE_THRESHOLD
  ) {
    return null;
  }

  // 🔒 Normalize executable fields
  const intentObj = {
    intent,
    rawText,
    llm: true,
    confidence
  };

  // Attach parameters safely
  if (intent === "OPEN_APP" && parsed.app) {
    intentObj.app = parsed.app.toLowerCase();
  }

  if (intent === "OPEN_FOLDER" && parsed.path) {
    intentObj.path = parsed.path;
  }

  if (intent === "SEARCH" && parsed.query) {
    intentObj.query = parsed.query;
  }

  if (intent === "YOUTUBE" && parsed.query) {
    intentObj.query = parsed.query;
  }

  if (intent === "LOCAL_SKILL" && parsed.skill) {
    intentObj.skill = parsed.skill.toUpperCase();
  }

  return intentObj;
}

module.exports = {
  resolveIntentWithLLM
};