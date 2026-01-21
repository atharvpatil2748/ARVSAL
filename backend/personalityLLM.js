/**
 * Personality LLM Enhancer
 *
 * Rewrites replies to sound natural and human
 * Must NEVER block the main response pipeline
 */

const { execSync } = require("child_process");
const { buildSystemPrompt } = require("./llmPrompt");

/* ================= DECISION ================= */

function shouldUseLLM(text) {
  if (!text) return false;

  // Very short replies → no LLM
  if (text.length < 25) return false;

  // Hard factual / memory / system replies → no LLM
  if (
    /(you told me|stored as memory|explicit memory|on .* at|opening|system locked|volume|searching)/i.test(
      text
    )
  ) {
    return false;
  }

  return true;
}

function chooseModel(text) {
  // Fast for short conversational replies
  if (text.length < 120) return "phi3:mini";

  // Better reasoning for longer rewrites
  return "mistral:7b-instruct";
}

/* ================= CORE ================= */

async function enhanceWithLLM(text) {
  if (!shouldUseLLM(text)) {
    return text; // 🔒 deterministic fast path
  }

  try {
    const model = chooseModel(text);

    const systemPrompt = buildSystemPrompt({
      mode: "neutral",
      humour: true
    });

    const output = execSync(
      `ollama run ${model}`,
      {
        input:
`${systemPrompt}

Original reply:
${text}

Rewrite the reply to sound natural, friendly, and human.
Keep it concise. Do not add honorifics or names.`,
        encoding: "utf8",
        timeout: 1500
      }
    ).trim();

    return output || text;
  } catch {
    // 🔒 ABSOLUTE FAIL-SAFE
    return text;
  }
}

/* ================= EXPORT ================= */

module.exports = {
  enhanceWithLLM
};