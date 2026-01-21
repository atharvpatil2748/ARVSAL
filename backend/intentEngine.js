/**
 * Lightweight Intent Engine (SAFE FALLBACK)
 *
 * ⚠️ This file is intentionally conservative.
 * It MUST NOT hallucinate memory or invent intent types.
 * All heavy reasoning is delegated to intentClassifier.js.
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

  /* ================= TIME / DATE ================= */

  if (
    lower === "time" ||
    lower.includes("what time") ||
    lower.includes("current time")
  ) {
    return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
  }

  if (
    lower === "date" ||
    lower.includes("what date") ||
    lower.includes("today")
  ) {
    return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
  }

  /* ================= MEMORY WRITE (STRICT) ================= */

  if (lower.startsWith("remember ") && /\s is \s/i.test(lower)) {
    const body = original.slice(8);
    const [key, value] = body.split(/\s+is\s+/i);

    if (key && value) {
      return {
        intent: "REMEMBER",
        key: key.trim(),
        value: value.trim(),
        rawText: original
      };
    }
  }

  /* ================= MEMORY READ ================= */

  if (
    /^(what is|who is|who am i|what does)\b/i.test(lower)
  ) {
    const key = lower
      .replace(/^what is\s+/i, "")
      .replace(/^who am i$/i, "identity")
      .replace(/^who is\s+/i, "")
      .replace(/^what does\s+/i, "")
      .trim();

    return { intent: "RECALL", key, rawText: original };
  }

  /* ================= CONTEXT FOLLOW-UP ================= */

  if (lower === "it" || lower === "that") {
    return { intent: "RECALL", key: "it", rawText: original };
  }

  /* ================= GREETING ================= */

  if (["hi", "hello", "hey"].includes(lower)) {
    return { intent: "SMALLTALK", rawText: original };
  }

  /* ================= OPEN APP ================= */

  if (lower.startsWith("open ")) {
    const app = lower.replace("open ", "").trim();
    return { intent: "OPEN_APP", app, rawText: original };
  }

  /* ================= DEFAULT ================= */

  // IMPORTANT:
  // Do NOT guess memory or facts here.
  // Let the main classifier / LLM decide.
  return { intent: "GENERAL_QUESTION", rawText: original };
}

module.exports = detectIntent;























// function detectIntent(text) {
//   text = text.toLowerCase();

//   // MEMORY: remember X is Y
//   if (text.startsWith("remember")) {
//     // example: remember my name is atharv
//     const parts = text.replace("remember", "").trim();

//     if (parts.includes(" is ")) {
//       const [key, value] = parts.split(" is ");
//       return {
//         intent: "REMEMBER",
//         key: key.trim(),
//         value: value.trim()
//       };
//     }
//   }

//   // MEMORY: what is X
//   // MEMORY RECALL — only personal facts
// if (text.startsWith("what is")) {
//   const key = text.replace("what is", "").trim();

//   // Only recall if it's clearly personal
//   if (
//     key.startsWith("my ") ||
//     key.startsWith("your ") ||
//     key.includes("name") ||
//     key.includes("favorite")
//   ) {
//     return {
//       intent: "RECALL",
//       key
//     };
//   }

//   // Otherwise, it's general knowledge → AI
//   return { intent: "UNKNOWN" };
// }


//   if (text.includes("hello") || text.includes("hi")) {
//     return { intent: "GREET" };
//   }

//   if (text.includes("time")) {
//     return { intent: "GET_TIME" };
//   }

//   if (text.includes("date")) {
//     return { intent: "GET_DATE" };
//   }

//   if (text.includes("open")) {
//     const app = text.replace("open", "").trim();
//     return { intent: "OPEN_APP", app };
//   }

//   return { intent: "UNKNOWN" };
// }

// module.exports = detectIntent;

