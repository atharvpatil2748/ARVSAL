/**
 * Personality LLM Enhancer
 *
 * Light conversational polish ONLY
 *
 * GUARANTEES:
 * - Meaning is preserved
 * - No questions added
 * - No memory / time / identity claims
 * - No honorifics or emojis
 * - Fail-safe by design
 */

const { runLLM } = require("./llmRunner");
const { buildSystemPrompt } = require("./llmPrompt");
const isSafeLLMOutput = require("./llmGuard");

/* ================= CORE ================= */

async function enhanceWithLLM(text, options = {}) {
  if (!text || typeof text !== "string") return text;

  const cleanText = text.trim();

  // personality.js already filtered aggressively
  // This layer ONLY does light polish
  if (cleanText.length < 25) return text;

  // Explicitly lock safety expectations (documented, not dynamic)
  // options are intentionally NOT behavior-changing here
  // They exist to signal caller intent and future-proof the API
  void options;

  const model = chooseModel(cleanText);

  const systemPrompt = buildSystemPrompt({
    mode: "neutral",
    humour: true,
    noQuestions: true,
    stopOnDone: true
  });

  const prompt = `
${systemPrompt}

Rewrite the following reply to sound natural, calm, and human.

TEXT:
"${cleanText}"

RULES (STRICT):
- Preserve original meaning exactly
- No questions
- No memory or time references
- No names, honorifics, or emojis
- No new facts
- Keep tone warm but neutral
- Similar length
- End with a statement
`.trim();

  try {
    const output = await runLLM({
      model,
      prompt,
      timeout: 30000
    });

    if (!output || typeof output !== "string") return text;

    const cleaned = sanitize(output);

    // 🔒 Soft safety (never destructive)
    if (!cleaned || cleaned.length < 5) return text;
    if (!isSafeLLMOutput(cleaned)) return text;

    return cleaned;
  } catch {
    return text; // absolute fail-safe
  }
}

/* ================= MODEL SELECTION ================= */

function chooseModel(text) {
  if (text.length < 120) return "phi3:mini";
  return "mistral:7b-instruct";
}

/* ================= SANITIZER ================= */

function sanitize(text) {
  let t = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();

  // Only strip fenced code if it wraps the ENTIRE output
  if (/^```[\s\S]*```$/g.test(t)) {
    t = t.replace(/^```[\s\S]*?```$/g, "").trim();
  }

  return t.replace(/\s{2,}/g, " ").trim();
}

/* ================= EXPORT ================= */

module.exports = {
  enhanceWithLLM
};












// /**
//  * Personality LLM Enhancer
//  *
//  * Rewrites replies to sound natural and human
//  * Must NEVER block the main response pipeline
//  */

// const { execSync } = require("child_process");
// const { buildSystemPrompt } = require("./llmPrompt");

// /* ================= DECISION ================= */

// function shouldUseLLM(text) {
//   if (!text) return false;

//   // Very short replies → no LLM
//   if (text.length < 25) return false;

//   // Hard factual / memory / system replies → no LLM
//   if (
//     /(you told me|stored as memory|explicit memory|on .* at|opening|system locked|volume|searching)/i.test(
//       text
//     )
//   ) {
//     return false;
//   }

//   return true;
// }

// function chooseModel(text) {
//   // Fast for short conversational replies
//   if (text.length < 120) return "phi3:mini";

//   // Better reasoning for longer rewrites
//   return "mistral:7b-instruct";
// }

// /* ================= CORE ================= */

// async function enhanceWithLLM(text) {
//   if (!shouldUseLLM(text)) {
//     return text; // 🔒 deterministic fast path
//   }

//   try {
//     const model = chooseModel(text);

//     const systemPrompt = buildSystemPrompt({
//       mode: "neutral",
//       humour: true
//     });

//     const output = execSync(
//       `ollama run ${model}`,
//       {
//         input:
// `${systemPrompt}

// Original reply:
// ${text}

// Rewrite the reply to sound natural, friendly, and human.
// Keep it concise. Do not add honorifics or names.`,
//         encoding: "utf8",
//         timeout: 1500
//       }
//     ).trim();

//     return output || text;
//   } catch {
//     // 🔒 ABSOLUTE FAIL-SAFE
//     return text;
//   }
// }

// /* ================= EXPORT ================= */

// module.exports = {
//   enhanceWithLLM
// };