/**
 * Personality Layer (Deterministic, Zero-Latency)
 *
 * NO LLM calls.
 * NO rewriting.
 * NO hallucinations.
 */

 /* ================= INTERNAL STATE ================= */

let replyCount = 0;
let lastAddressedAt = 0;

const ADDRESS_TERM = "sir";

/* ================= HARD BLOCK ================= */

// Replies that must NEVER be touched or styled
const HARD_NO_LLM = new RegExp(
  [
    "\\byour\\s+[a-z]{2,20}\\s+is\\b",
    "\\byou told me\\b",
    "\\bstored as memory\\b",
    "\\bexplicit memory\\b",
    "\\bare you sure\\b",
    "\\bopening\\b",
    "\\bsystem locked\\b",
    "\\bvolume (increased|decreased|muted)\\b",
    "\\blocked\\b",
    "\\bcurrent time\\b",
    "\\btoday'?s date\\b",
    "\\btemperature\\b",
    "\\bweather\\b",
    "\\bnews\\b"
  ].join("|"),
  "i"
);

/* ================= CODE DETECTION ================= */

// 🚨 Any code-like output must NEVER be modified
function containsCode(text) {
  return (
    /```[\s\S]*?```/.test(text) ||            // fenced code
    /^\s*#include\s+</m.test(text) ||         // C / C++
    /^\s*(int|void|char|float|double)\s+\w+/m.test(text) ||
    /^\s*function\s+\w+/m.test(text) ||       // JS
    /^\s*\w+\s*=\s*function/m.test(text) ||
    /^\s*class\s+\w+/m.test(text) ||
    /^\s*def\s+\w+/m.test(text) ||            // Python
    /;\s*$/.test(text)                        // code-like ending
  );
}

/* ================= MAIN ================= */

async function applyPersonality(text) {
  if (typeof text !== "string") return "";
  text = text.trim();
  if (!text) return "";

  // Remove accidental "Arvsal:" prefix leakage
  text = text.replace(/^(arvsal\s*:\s*)+/i, "");

  replyCount++;
  const lower = text.toLowerCase();

  /* 🔒 ABSOLUTE PRESERVATION RULES */

  // Code must remain untouched
  if (containsCode(text)) {
    return text;
  }

  // System / memory / action responses
  if (HARD_NO_LLM.test(lower)) {
    return finalize(text);
  }

  // Long or technical responses (essay, explanation, steps)
  if (
    text.length > 300 ||
    /step by step|essay|algorithm|equation|proof/i.test(lower)
  ) {
    return finalize(text);
  }

  // Very short confirmations
  if (
    text.length <= 6 &&
    /^(ok|okay|sure|done|yes|no)$/i.test(lower)
  ) {
    return finalize(text);
  }

  // Normal conversational response
  return finalize(text);
}

/* ================= FINALIZATION ================= */

function finalize(text) {
  return maybeAddress(ensurePunctuation(text));
}

/* ================= JARVIS-STYLE ADDRESSING ================= */

function maybeAddress(text) {
  const lower = text.toLowerCase();

  // 🚫 Never address in commands, memory, system replies
  if (
    HARD_NO_LLM.test(lower) ||
    text.length < 12 ||
    /^(yes|no|ok|okay|done)$/i.test(lower)
  ) {
    return text;
  }

  // 🧠 Natural Jarvis spacing
  const shouldAddress =
    replyCount - lastAddressedAt >= 4 && // not frequent
    Math.random() < 0.3 &&               // occasional
    !/^sir[, ]/i.test(text);             // no duplication

  if (shouldAddress) {
    lastAddressedAt = replyCount;

    // Two Jarvis-style forms
    if (Math.random() < 0.5) {
      return `Sir, ${text}`;
    } else {
      return `${text.replace(/[.!?]?$/, `, ${ADDRESS_TERM}.`)}`;
    }
  }

  return text;
}

/* ================= HELPERS ================= */

function ensurePunctuation(text) {
  return /[.!?]$/.test(text) ? text : text + ".";
}

/* ================= EXPORT ================= */

module.exports = applyPersonality;













// /**
//  * Personality Layer
//  *
//  * FINAL AUTHORITY GATE
//  *
//  * - LLM is OPTIONAL
//  * - Memory & system replies are SACRED
//  * - CODE OUTPUT IS SACRED
//  * - NEVER distorts long-form or technical answers
//  * - NEVER invents facts or uncertainty
//  */

// const { enhanceWithLLM } = require("./personalityLLM");

// /* ================= INTERNAL STATE ================= */

// let replyCount = 0;
// let lastAddressedAt = 0;

// const ADDRESS_PREFIX = null;

// /* ================= HARD BLOCK ================= */

// const HARD_NO_LLM = new RegExp(
//   [
//     "\\byour\\s+[a-z]{2,20}\\s+is\\b",
//     "\\byou told me\\b",
//     "\\bstored as memory\\b",
//     "\\bexplicit memory\\b",
//     "\\bare you sure\\b",
//     "\\bopening\\b",
//     "\\bsystem locked\\b",
//     "\\bvolume (increased|decreased|muted)\\b",
//     "\\blocked\\b"
//   ].join("|"),
//   "i"
// );

// /* ================= CODE DETECTION (CRITICAL FIX) ================= */

// // ANY of these → DO NOT TOUCH
// function containsCode(text) {
//   return (
//     /```[\s\S]*?```/.test(text) ||          // fenced code
//     /^\s*#include\s+</m.test(text) ||       // C / C++
//     /^\s*(int|void|char|float|double)\s+\w+/m.test(text) ||
//     /^\s*function\s+\w+/m.test(text) ||     // JS
//     /^\s*\w+\s*=\s*function/m.test(text) ||
//     /^\s*class\s+\w+/m.test(text) ||
//     /^\s*def\s+\w+/m.test(text) ||          // Python
//     /;\s*$/.test(text)                      // code-like ending
//   );
// }

// /* ================= MAIN ================= */

// async function applyPersonality(text) {
//   if (typeof text !== "string") return "";
//   text = text.trim();
//   if (!text) return "";

//   // Remove accidental self-prefix leakage
//   text = text.replace(/^(arvsal\s*:\s*)+/i, "");

//   replyCount++;
//   const lower = text.toLowerCase();

//   /* 🔒 ABSOLUTE CODE PRESERVATION */
//   if (containsCode(text)) {
//     return text; // 🚨 DO NOT TOUCH
//   }

//   /* 🔒 SYSTEM / MEMORY / ACTION RESPONSES */
//   if (HARD_NO_LLM.test(lower)) {
//     return finalize(text);
//   }

//   /* 🔒 LONG / TECHNICAL RESPONSES */
//   if (
//     text.length > 300 ||
//     /step by step|essay|algorithm|equation|proof/i.test(lower)
//   ) {
//     return finalize(text);
//   }

//   /* 🔒 VERY SHORT CONFIRMATIONS */
//   if (
//     text.length <= 6 &&
//     /^(ok|okay|sure|done|yes|no)$/i.test(lower)
//   ) {
//     return finalize(text);
//   }

//   /* 🧠 LIGHT CONVERSATIONAL POLISH ONLY */
//   try {
//     const enhanced = await enhanceWithLLM(text, {
//       forbidQuestions: true,
//       keepMeaning: true,
//       forbidMemoryClaims: true,
//       forbidTimeClaims: true
//     });

//     if (typeof enhanced === "string" && enhanced.trim()) {
//       return finalize(enhanced.trim());
//     }
//   } catch {
//     // absolute fail-safe
//   }

//   return finalize(text);
// }

// /* ================= FINALIZATION ================= */

// function finalize(text) {
//   return maybeAddress(ensurePunctuation(text));
// }

// /* ================= ADDRESSING ================= */

// function maybeAddress(text) {
//   if (!ADDRESS_PREFIX) return text;

//   const shouldAddress =
//     replyCount - lastAddressedAt >= 3 &&
//     Math.random() < 0.25 &&
//     !new RegExp(`^${ADDRESS_PREFIX}[, ]`, "i").test(text);

//   if (shouldAddress) {
//     lastAddressedAt = replyCount;
//     return `${ADDRESS_PREFIX}, ${text}`;
//   }

//   return text;
// }

// /* ================= HELPERS ================= */

// function ensurePunctuation(text) {
//   return /[.!?]$/.test(text) ? text : text + ".";
// }

// module.exports = applyPersonality;

