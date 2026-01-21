/**
 * 🔒 LLM OUTPUT SAFETY GUARD
 *
 * Purpose:
 * - Final firewall before Arvsal speaks
 * - Prevents hallucinated memory, sources, time, identity, and system leaks
 *
 * IMPORTANT:
 * - This function MUST be conservative
 * - False negatives are acceptable
 * - False positives are NOT
 */

function isSafeLLMOutput(text) {
  if (!text || typeof text !== "string") return false;

  const lower = text.toLowerCase();

  /* ================= UNCERTAINTY (FACTUAL HALLUCINATION) ================= */

  const uncertaintyPhrases = [
    "i think",
    "maybe",
    "probably",
    "i assume",
    "not sure",
    "it seems",
    "might be"
  ];

  if (uncertaintyPhrases.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= MEMORY & TIME FABRICATION ================= */

  const fakeMemoryPhrases = [
    "earlier you told me",
    "you mentioned before",
    "as you said earlier",
    "last time we talked",
    "previously you said",
    "earlier today",
    "recently",
    "a while ago"
  ];

  if (fakeMemoryPhrases.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= SOURCE / TRAINING / MODEL LEAKS ================= */

  const systemLeakPhrases = [
    "as an ai model",
    "trained on",
    "training data",
    "openai",
    "groq",
    "deepseek",
    "llama",
    "model",
    "dataset",
    "neural network"
  ];

  if (systemLeakPhrases.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= BACKGROUND ACTIVITY CLAIMS ================= */

  const backgroundClaims = [
    "i have been monitoring",
    "i was watching",
    "i keep track of",
    "i automatically",
    "running in the background"
  ];

  if (backgroundClaims.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= OK ================= */

  return true;
}

module.exports = isSafeLLMOutput;


















// function isSafeLLMOutput(text) {
//   if (!text) return false;

//   const banned = [
//     "i think",
//     "maybe",
//     "probably",
//     "i assume",
//     "not sure"
//   ];

//   return !banned.some(b => text.toLowerCase().includes(b));
// }

// module.exports = isSafeLLMOutput;
