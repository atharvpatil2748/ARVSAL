const DEBUG = process.env.LLM_DEBUG === "true";

function llmDebug(...args) {
  if (!DEBUG) return;
  console.log("[LLM_DEBUG]", ...args);
}

module.exports = llmDebug;