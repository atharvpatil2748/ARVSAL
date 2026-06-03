/**
 * UI WORLD MODEL
 * Short-term screen memory (Jarvis core)
 * Stateless vision → stateful agent
 */

let state = {
  screenType: "unknown",
  ocrText: "",
  screenshotMeta: null,

  elements: new Map(),          // key -> { x,y,label,confidence,ts }
  elementHistory: [],

  lastAction: null,
  lastActionResult: null,

  lastUpdate: 0,
  stabilityScore: 0,            // how stable UI is across frames
  activeAppHint: null
};

/* ================= BASIC ================= */

function updateScreen({ screenType, ocrText, screenshotMeta }) {
  state.screenType = screenType ?? state.screenType;
  state.ocrText = ocrText ?? state.ocrText;
  state.screenshotMeta = screenshotMeta ?? state.screenshotMeta;
  state.lastUpdate = Date.now();
}

/* ================= ELEMENTS ================= */

function rememberElement(key, element) {
  if (!key || !element) return;

  const record = {
    ...element,
    ts: Date.now()
  };

  state.elements.set(key, record);
  state.elementHistory.push({ key, ...record });

  // limit history
  if (state.elementHistory.length > 200) {
    state.elementHistory.shift();
  }
}

function getElement(key) {
  return state.elements.get(key) || null;
}

function clearElements() {
  state.elements.clear();
}

/* ================= ACTION ================= */

function setLastAction(action) {
  state.lastAction = {
    ...action,
    ts: Date.now()
  };
}

function setActionResult(result) {
  state.lastActionResult = {
    ...result,
    ts: Date.now()
  };
}

/* ================= STABILITY ================= */

/**
 * Compare OCR to estimate UI stability
 */
function updateStability(newOCR) {
  if (!state.ocrText || !newOCR) {
    state.stabilityScore = 0;
    return;
  }

  const overlap =
    newOCR.split(" ").filter(w => state.ocrText.includes(w)).length /
    Math.max(1, newOCR.split(" ").length);

  state.stabilityScore = overlap;
}

/* ================= APP HINT ================= */

function setActiveAppHint(name) {
  state.activeAppHint = name;
}

/* ================= SNAPSHOT ================= */

function snapshot() {
  return {
    screenType: state.screenType,
    stabilityScore: state.stabilityScore,
    lastAction: state.lastAction,
    lastActionResult: state.lastActionResult,
    elementCount: state.elements.size,
    activeAppHint: state.activeAppHint,
    lastUpdate: state.lastUpdate
  };
}

/* ================= RESET ================= */

function reset() {
  state.elements.clear();
  state.elementHistory = [];
  state.lastAction = null;
  state.lastActionResult = null;
  state.stabilityScore = 0;
}

function getLastElements() {
  return Array.from(state.elements.values());
}

module.exports = {
  updateScreen,
  rememberElement,
  getElement,
  clearElements,
  getLastElements,
  setLastAction,
  setActionResult,
  updateStability,
  setActiveAppHint,
  snapshot,
  reset
};