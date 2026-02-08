/**
 * AI Switch
 *
 * Runtime-safe external model selector
 *
 * DESIGN GUARANTEES:
 * - Defaults to local
 * - Idempotent switches
 * - Never throws
 * - Never validates API keys
 * - Single source of truth
 * - Cooldown-aware (NEW)
 */

const ALLOWED_AI = new Set(["local", "chatgpt", "gemini"]);

// ================= STATE =================

let ACTIVE_AI = "local";

// Temporary disable tracking
const DISABLED_UNTIL = {
  chatgpt: 0,
  gemini: 0
};

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// ================= CORE =================

function setActiveAI(type) {
  if (!ALLOWED_AI.has(type)) return false;

  // Cooldown guard
  if (type !== "local" && Date.now() < DISABLED_UNTIL[type]) {
    return false;
  }

  if (ACTIVE_AI === type) return true;

  ACTIVE_AI = type;
  return true;
}

// ================= PUBLIC API =================

function connectChatGPT() {
  return setActiveAI("chatgpt");
}

function connectGemini() {
  return setActiveAI("gemini");
}

function connectLocal() {
  return setActiveAI("local");
}

function disconnectAI() {
  return setActiveAI("local");
}

function getActiveAI() {
  return ACTIVE_AI;
}

function isExternalAIActive() {
  return ACTIVE_AI !== "local";
}

function isLocalAIActive() {
  return ACTIVE_AI === "local";
}

// ================= FAILURE SIGNAL (NEW) =================

function markAIUnavailable(type) {
  if (!ALLOWED_AI.has(type) || type === "local") return;

  DISABLED_UNTIL[type] = Date.now() + COOLDOWN_MS;

  // If currently active, fall back to local
  if (ACTIVE_AI === type) {
    ACTIVE_AI = "local";
  }
}

// ================= EXPORT =================

module.exports = {
  // setters
  setActiveAI,
  connectChatGPT,
  connectGemini,
  connectLocal,
  disconnectAI,

  // getters
  getActiveAI,
  isExternalAIActive,
  isLocalAIActive,

  // failure handling
  markAIUnavailable
};