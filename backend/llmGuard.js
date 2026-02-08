/**
 * 🔒 LLM OUTPUT SAFETY GUARD
 *
 * Final firewall before Arvsal speaks.
 *
 * Design principles:
 * - Block CLAIMS, not vocabulary
 * - Allow uncertainty (safety > confidence)
 * - Zero tolerance for memory / identity fabrication
 * - Conservative by default
 */

function isSafeLLMOutput(text) {
  if (!text || typeof text !== "string") return false;

  const lower = text.toLowerCase();

  /* ================= FABRICATED MEMORY CLAIMS ================= */

  const fakeMemoryClaims = [
    "earlier you told me",
    "you mentioned before",
    "as you said earlier",
    "last time we talked",
    "previously you said",
    "you told me",
    "i remember when you",
    "from our past conversation"
  ];

  if (fakeMemoryClaims.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= IDENTITY & ROLE LEAKS ================= */

  const identityLeaks = [
    "as an ai language model",
    "as an ai model",
    "i am an ai",
    "i was trained on",
    "my training data",
    "i don't have access to memory but",
    "openai trained me",
    "google trained me"
  ];

  if (identityLeaks.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= BACKGROUND / AUTONOMY CLAIMS ================= */

  const forbiddenAutonomy = [
    "i have been monitoring",
    "i was watching you",
    "i keep track of you",
    "running in the background",
    "i automatically track",
    "i continuously monitor"
  ];

  if (forbiddenAutonomy.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= SYSTEM / CONTROL CLAIMS ================= */

  const systemAuthorityClaims = [
    "i decided to",
    "i chose to",
    "i took the initiative",
    "i acted on my own",
    "without being asked"
  ];

  if (systemAuthorityClaims.some(p => lower.includes(p))) {
    return false;
  }

  /* ================= SAFE ================= */

  return true;
}

module.exports = isSafeLLMOutput;













// /**
//  * 🔒 LLM OUTPUT SAFETY GUARD
//  *
//  * Purpose:
//  * - Final firewall before Arvsal speaks
//  * - Prevents hallucinated memory, sources, time, identity, and system leaks
//  *
//  * IMPORTANT:
//  * - This function MUST be conservative
//  * - False negatives are acceptable
//  * - False positives are NOT
//  */

// function isSafeLLMOutput(text) {
//   if (!text || typeof text !== "string") return false;

//   const lower = text.toLowerCase();

//   /* ================= UNCERTAINTY (FACTUAL HALLUCINATION) ================= */

//   const uncertaintyPhrases = [
//     "i think",
//     "maybe",
//     "probably",
//     "i assume",
//     "not sure",
//     "it seems",
//     "might be"
//   ];

//   if (uncertaintyPhrases.some(p => lower.includes(p))) {
//     return false;
//   }

//   /* ================= MEMORY & TIME FABRICATION ================= */

//   const fakeMemoryPhrases = [
//     "earlier you told me",
//     "you mentioned before",
//     "as you said earlier",
//     "last time we talked",
//     "previously you said",
//     "earlier today",
//     "recently",
//     "a while ago"
//   ];

//   if (fakeMemoryPhrases.some(p => lower.includes(p))) {
//     return false;
//   }

//   /* ================= SOURCE / TRAINING / MODEL LEAKS ================= */

//   const systemLeakPhrases = [
//     "as an ai model",
//     "trained on",
//     "training data",
//     "openai",
//     "groq",
//     "deepseek",
//     "llama",
//     "model",
//     "dataset",
//     "neural network"
//   ];

//   if (systemLeakPhrases.some(p => lower.includes(p))) {
//     return false;
//   }

//   /* ================= BACKGROUND ACTIVITY CLAIMS ================= */

//   const backgroundClaims = [
//     "i have been monitoring",
//     "i was watching",
//     "i keep track of",
//     "i automatically",
//     "running in the background"
//   ];

//   if (backgroundClaims.some(p => lower.includes(p))) {
//     return false;
//   }

//   /* ================= OK ================= */

//   return true;
// }

// module.exports = isSafeLLMOutput;













