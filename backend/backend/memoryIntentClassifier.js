/**
 * Memory Intent Classifier – Relevance Mode
 *
 * - No blocking
 * - Always returns low/high recall signal
 * - Suggests subject
 */

const { embedText } = require("./embeddingModel");
const memory = require("./memory");
const { resolveDateRange } = require("./dateResolver");

/* =============== COSINE =============== */

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  if (!ma || !mb) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

/* =============== RECALL LANGUAGE CHECK =============== */

function detectRecallStrength(text) {
  const strong = /\b(remember|recall|what|when|where|who|how was|did i|was i|yesterday|last week|last month)\b/i;
  const medium = /\b(my|mine|about me|tell me about)\b/i;

  if (strong.test(text)) return "strong";
  if (medium.test(text)) return "medium";
  return "weak";
}

/* =============== SUBJECT SUGGESTION =============== */

async function suggestSubject(queryEmbedding) {
  const subjects = Object.keys(memory.facts || {});
  if (!subjects.length) return "user";

  let best = "user";
  let bestScore = 0;

  for (const s of subjects) {
    const emb = await embedText(`information about ${s}`);
    if (!emb) continue;
    const score = cosine(queryEmbedding, emb);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return bestScore > 0.55 ? best : "user";
}

/* =============== MAIN =============== */

async function classifyMemoryIntent(text) {

  if (!text || typeof text !== "string") {
    return { recallStrength: "weak", subject: "user", confidence: 0 };
  }

  const embedding = await embedText(text);
  if (!embedding) {
    return { recallStrength: "weak", subject: "user", confidence: 0 };
  }

  const recallStrength = detectRecallStrength(text);
  const subject = await suggestSubject(embedding);

  let confidence = 0.5;
  if (recallStrength === "strong") confidence += 0.3;
  if (resolveDateRange(text)) confidence += 0.2;

  confidence = Math.min(confidence, 1);

  return {
    recallStrength,
    subject,
    confidence
  };
}

module.exports = { classifyMemoryIntent };