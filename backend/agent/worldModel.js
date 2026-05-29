/**
 * World Model — Minimal (Phase 3)
 *
 * Purpose:
 * Provide a single coherent snapshot of reality for planner.
 *
 * NO intelligence here.
 * Only packaging state.
 */

const uiState = require("./uiStateStore");
const interaction = require("./interactionModeManager");

/* ================= BUILD WORLD CONTEXT ================= */

function buildWorldContext({
  userInput,
  screenType,
  memoryResult
}) {
  const uiSnapshot = safeGetUISnapshot();

  const relevantMemory = memoryResult?.relevantMemory || [];
  const actionHints = memoryResult?.actionHints || [];
  const missingInfo = memoryResult?.missingInfo || [];

  return {
    intent: userInput,

    interactionMode: interaction.getMode?.() || "unknown",

    screen: {
      type: screenType,
      ocrPreview: (uiSnapshot?.ocrText || "").slice(0, 800)
    },

    ui: uiSnapshot,

    memory: {
      relevantMemory,
      actionHints,
      missingInfo
    },

    timestamp: Date.now()
  };
}

/* ================= SAFE UI SNAPSHOT ================= */

function safeGetUISnapshot() {
  try {
    return uiState.getSnapshot ? uiState.getSnapshot() : {};
  } catch {
    return {};
  }
}

module.exports = {
  buildWorldContext
};