/**
 * Reflection Generator
 *
 * Converts reflection trigger signals into
 * structured reflection objects.
 *
 * RULES:
 * - LLM is OPTIONAL
 * - JSON ONLY
 * - NO side effects
 * - FAIL-SAFE
 */

const { runLLM } = require("./llmRunner");
const { buildSystemPrompt } = require("./llmPrompt");


/* ================= CONFIG ================= */

const MODEL = "mistral:7b-instruct";
const TIMEOUT_MS = 20000;


/* ================= SAFE JSON ================= */

function safeParseJSON(text) {
  try {
    if (!text || typeof text !== "string") return null;

    // 🔒 Extract FIRST valid JSON object only
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}


/* ================= FALLBACK (NO LLM) ================= */

function generateFallbackReflection(signal) {
  return {
    subject: signal.subject,
    summary: `Repeated patterns detected related to ${signal.dominantKeys?.[0] || "recurring topics"}.`,
    themes: (signal.dominantKeys || []).slice(0, 3),
    insights: [
      "User consistently revisits similar topics over time."
    ],
    confidence: signal.avgImportance || 0.7
  };
}


/* ================= CORE ================= */

/**
 * Generate reflection object
 * @param {object} signal
 * @returns {object|null}
 */
async function generateReflection(signal) {
  if (!signal || !signal.subject || !Array.isArray(signal.sampleEvents)) {
    return null;
  }

  const systemPrompt = buildSystemPrompt({
    mode: "neutral",
    humour: false,
    noQuestions: true,
    stopOnDone: true
  });

  const prompt = `
${systemPrompt}

You are a MEMORY REFLECTION ENGINE.

TASK:
- Detect recurring patterns
- Produce a structured reflection
- NO conversation tone
- NO advice
- NO questions

INPUT:
${JSON.stringify(signal, null, 2)}

OUTPUT JSON ONLY:

{
  "summary": "...",
  "themes": ["theme1"],
  "insights": ["insight"],
  "confidence": 0.0
}

RULES:
- Summary ≤ 2 sentences
- Max 3 themes
- Max 3 insights
- Confidence 0.0–1.0
`;

  let raw = null;

  try {
    raw = await runLLM({
      model: MODEL,
      prompt,
      timeout: TIMEOUT_MS
    });
  } catch {
    raw = null;
  }

  const parsed = safeParseJSON(raw);

  // 🔒 LLM FAILURE → deterministic fallback
  if (!parsed || typeof parsed.summary !== "string") {
    return generateFallbackReflection(signal);
  }

  return {
    subject: signal.subject, // 🔒 NEVER trust LLM subject
    summary: parsed.summary.trim(),
    themes: Array.isArray(parsed.themes)
      ? parsed.themes.slice(0, 3)
      : [],
    insights: Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 3)
      : [],
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : signal.avgImportance || 0.7
  };
}


/* ================= EXPORT ================= */

module.exports = {
  generateReflection
};