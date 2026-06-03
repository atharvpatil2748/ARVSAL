// backend/agent/interactionModeManager.js

let MODE = "chat"; 
// chat | action | mixed | suggestion | pending

function setMode(m) {
  MODE = m;
}

function getMode() {
  return MODE;
}

function isActionMode() {
  return MODE === "action" || MODE === "mixed";
}

function resetMode() {
  MODE = "chat";
}

module.exports = {
  setMode,
  getMode,
  isActionMode,
  resetMode
};