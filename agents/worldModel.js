/**
 * World Model — Minimal (Phase 3)
 *
 * Purpose:
 * Provide a single coherent snapshot of reality for planner.
 *
 * NO intelligence here.
 * Only packaging state.
 */

const uiState = require('@agents/uiStateStore');
const interaction = require('@agents/interactionModeManager');

/* ================= BUILD WORLD CONTEXT ================= */

function buildWorldContext({
  userInput,
  screenType,
  memoryContext
}) {
  const uiSnapshot = safeGetUISnapshot();

  const relevantMemory = memoryContext?.relevantMemory || [];
  const workingNodes = memoryContext?.workingNodes || [];
  const constraints = memoryContext?.constraints || [];
  const activeProject = memoryContext?.activeProject || null;

  return {
    intent: userInput,

    interactionMode: interaction.getMode?.() || "unknown",

    screen: {
      type: screenType,
      ocrPreview: (uiSnapshot?.ocrText || "").slice(0, 800)
    },

    ui: uiSnapshot,

    memory: {
      workingNodes,
      constraints,
      activeProject,
      relevantMemory
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