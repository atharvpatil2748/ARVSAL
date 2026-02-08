/**
 * Intent Engine (SAFE FALLBACK)
 *
 * ⚠️ Intentionally conservative.
 * MUST NOT compete with intentClassifier.js
 * MUST NOT invent memory, subjects, or intents
 * MUST remain deterministic and safe
 */

function detectIntent(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { intent: "GENERAL_QUESTION", rawText: "" };
  }

  const original = text.trim();
  const lower = original.toLowerCase();

  /* ================= SELF / IDENTITY ================= */

  if (/^(who are you|what are you|introduce yourself)$/i.test(lower)) {
    return { intent: "INTRODUCE_SELF", rawText: original };
  }

  /* ================= TIME / DATE (STRICT) ================= */

  if (
    lower === "time" ||
    lower === "current time" ||
    lower.includes("what time")
  ) {
    return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
  }

  if (
    lower === "date" ||
    lower === "today date" ||
    lower.includes("what date")
  ) {
    return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
  }

  /* ================= MEMORY WRITE (ULTRA-STRICT) ================= */

  // Only allow: "remember X is Y"
  // Block ambiguous keys like "it / this / that"
  if (
    lower.startsWith("remember ") &&
    /\s+is\s+/i.test(lower) &&
    !/\b(time|date)\b/i.test(lower)
  ) {
    const body = original.slice(8).trim();
    const match = body.match(/^(.+?)\s+is\s+(.+)$/i);

    if (match) {
      const key = match[1].trim().toLowerCase();

      if (["it", "this", "that"].includes(key)) {
        return { intent: "GENERAL_QUESTION", rawText: original };
      }

      return {
        intent: "REMEMBER",
        key: match[1].trim(),
        value: match[2].trim(),
        rawText: original
      };
    }
  }

  /* ================= MEMORY READ (STRICT) ================= */

  if (/^(what is|who is|who am i|what does)\b/i.test(lower)) {
    const key = lower
      .replace(/^what is\s+/i, "")
      .replace(/^who am i$/i, "identity")
      .replace(/^who is\s+/i, "")
      .replace(/^what does\s+/i, "")
      .trim();

    if (key && !["it", "this", "that"].includes(key)) {
      return { intent: "RECALL", key, rawText: original };
    }
  }

  /* ================= CONTEXT FOLLOW-UP ================= */

  if (lower === "it" || lower === "that" || lower === "this") {
    return { intent: "RECALL", key: "it", rawText: original };
  }

  /* ================= SMALL TALK (MINIMAL) ================= */

  if (["hi", "hello", "hey"].includes(lower)) {
    return { intent: "SMALLTALK", rawText: original };
  }

  /* ================= OPEN APP (VERY NARROW) ================= */

  // Only allow single-word apps (avoid collisions)
  if (/^open\s+[a-z]{2,20}$/i.test(lower)) {
    const app = lower.replace(/^open\s+/i, "").trim();

    if (!["it", "this", "that"].includes(app)) {
      return { intent: "OPEN_APP", app, rawText: original };
    }
  }

  /* ================= DEFAULT ================= */

  // DO NOT GUESS
  // DO NOT INVENT
  // Let main classifier or LLM router decide
  return { intent: "GENERAL_QUESTION", rawText: original };
}

module.exports = detectIntent;










// /**
//  * Lightweight Intent Engine (SAFE FALLBACK)
//  *
//  * ⚠️ This file is intentionally conservative.
//  * It MUST NOT hallucinate memory or invent intent types.
//  * All heavy reasoning is delegated to intentClassifier.js.
//  */

// function detectIntent(text) {
//   if (typeof text !== "string" || !text.trim()) {
//     return { intent: "GENERAL_QUESTION", rawText: "" };
//   }

//   const original = text.trim();
//   const lower = original.toLowerCase();

//   /* ================= SELF / IDENTITY ================= */

//   if (/^(who are you|what are you|introduce yourself)$/i.test(lower)) {
//     return { intent: "INTRODUCE_SELF", rawText: original };
//   }

//   /* ================= TIME / DATE ================= */

//   if (
//     lower === "time" ||
//     lower.includes("what time") ||
//     lower.includes("current time")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
//   }

//   if (
//     lower === "date" ||
//     lower.includes("what date") ||
//     lower.includes("today")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
//   }

//   /* ================= MEMORY WRITE (STRICT) ================= */

//   if (lower.startsWith("remember ") && /\s is \s/i.test(lower)) {
//     const body = original.slice(8);
//     const [key, value] = body.split(/\s+is\s+/i);

//     if (key && value) {
//       return {
//         intent: "REMEMBER",
//         key: key.trim(),
//         value: value.trim(),
//         rawText: original
//       };
//     }
//   }

//   /* ================= MEMORY READ ================= */

//   if (
//     /^(what is|who is|who am i|what does)\b/i.test(lower)
//   ) {
//     const key = lower
//       .replace(/^what is\s+/i, "")
//       .replace(/^who am i$/i, "identity")
//       .replace(/^who is\s+/i, "")
//       .replace(/^what does\s+/i, "")
//       .trim();

//     return { intent: "RECALL", key, rawText: original };
//   }

//   /* ================= CONTEXT FOLLOW-UP ================= */

//   if (lower === "it" || lower === "that") {
//     return { intent: "RECALL", key: "it", rawText: original };
//   }

//   /* ================= GREETING ================= */

//   if (["hi", "hello", "hey"].includes(lower)) {
//     return { intent: "SMALLTALK", rawText: original };
//   }

//   /* ================= OPEN APP ================= */

//   if (lower.startsWith("open ")) {
//     const app = lower.replace("open ", "").trim();
//     return { intent: "OPEN_APP", app, rawText: original };
//   }

//   /* ================= DEFAULT ================= */

//   // IMPORTANT:
//   // Do NOT guess memory or facts here.
//   // Let the main classifier / LLM decide.
//   return { intent: "GENERAL_QUESTION", rawText: original };
// }

// module.exports = detectIntent;

















