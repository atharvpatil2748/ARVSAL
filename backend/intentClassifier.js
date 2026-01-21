/**
 * Intent Classifier
 *
 * Deterministic, object-safe, memory-safe
 * NO LLM dependency
 * NO hallucinated intent jumps
 */

function classifyIntent(input) {
  let original = "";
  let lower = "";

  // Accept string OR normalize() object
  if (typeof input === "string") {
    original = input.trim();
    lower = original.toLowerCase();
  } else if (input && typeof input === "object") {
    original = String(input.rawText || "").trim();
    lower = String(input.normalizedText || original).toLowerCase();
  }

  if (!original) {
    return { intent: "GENERAL_QUESTION", rawText: "" };
  }

  /* ================= 🔒 HARD BLOCK ================= */
  // Never allow storing time/date as memory
  if (
    lower.startsWith("remember ") &&
    /\b(time|date)\b/i.test(lower)
  ) {
    return { intent: "GENERAL_QUESTION", rawText: original };
  }

  /* ================= CONFIRMATION ================= */

  if (/^(yes|yeah|yep|sure|confirm|do it)$/i.test(lower)) {
    return { intent: "CONFIRM_YES", rawText: original };
  }

  if (/^(no|nope|cancel|don't|do not)$/i.test(lower)) {
    return { intent: "CONFIRM_NO", rawText: original };
  }

  /* ================= SELF INTRODUCTION ================= */

  if (/^(introduce yourself|who are you|what are you)$/i.test(lower)) {
    return { intent: "INTRODUCE_SELF", rawText: original };
  }

  /* ================= TIME / DATE (ABSOLUTE PRIORITY) ================= */

  if (
    lower === "time" ||
    lower === "current time" ||
    lower.includes("what time") ||
    lower.includes("tell me time")
  ) {
    return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
  }

  if (
    lower === "date" ||
    lower === "today date" ||
    lower.includes("today's date") ||
    lower.includes("what date")
  ) {
    return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
  }

  /* ================= META MEMORY (HOW / WHEN) ================= */

  if (
    /how do you (know|remember|learn)/i.test(lower) ||
    /how did you (know|remember|learn)/i.test(lower) ||
    /when did i (tell|say)/i.test(lower)
  ) {
    return {
      intent: "RECALL",
      key: "it",
      meta: true,
      rawText: original
    };
  }

  /* ================= DAY-BASED MEMORY ================= */

  if (/what did we talk about today/i.test(lower)) {
    return { intent: "DAY_RECALL", mode: "conversation", rawText: original };
  }

  if (/what did i say today/i.test(lower)) {
    return { intent: "DAY_RECALL", mode: "user_only", rawText: original };
  }

  if (/what do you remember today/i.test(lower)) {
    return { intent: "DAY_RECALL", mode: "memory", rawText: original };
  }

  if (/what happened today/i.test(lower)) {
    return { intent: "DAY_RECALL", mode: "summary", rawText: original };
  }

  /* ================= DATE-SPECIFIC MEMORY ================= */

  if (
    /(what happened|what did we talk about|what did i say|what do you remember)\s+on\s+/i.test(lower)
  ) {
    return { intent: "EPISODIC_BY_DATE", rawText: original };
  }

  /* ================= EPISODIC (NON-DATE) ================= */

  if (
    /what did i talk about|what did we chat earlier|previous conversation|earlier conversation/i.test(lower) ||
    /last time we talked|last conversation|last thing i said/i.test(lower)
  ) {
    return { intent: "EPISODIC_RECALL", rawText: original };
  }

  /* ================= MEMORY SUMMARY ================= */

  if (
    lower === "what do you know about me" ||
    lower === "what do you about me" || // typo-safe
    lower === "summarize my memory" ||
    lower.startsWith("what do you know about ") ||
    lower.startsWith("what do you remember about ")
  ) {
    return { intent: "MEMORY_SUMMARY", rawText: original };
  }

  /* ================= MEMORY FORGET ================= */

  if (/^(forget|delete|remove)\b/i.test(lower)) {
    const key = lower
      .replace(/^(forget|delete|remove)\s+/i, "")
      .replace(/^my\s+/i, "")
      .replace(/\s+is\s+.+$/i, "")
      .trim();

    return {
      intent: "FORGET",
      key: key || "it",
      rawText: original
    };
  }

  /* ================= CONTEXT FOLLOW-UP ================= */

  if (
    lower === "what is it" ||
    lower === "what is that" ||
    lower === "tell me about it"
  ) {
    return { intent: "RECALL", key: "it", rawText: original };
  }

  /* ================= SYSTEM / MEDIA ================= */

  if (/^mute$/i.test(lower)) return { intent: "MUTE", rawText: original };
  if (/^volume up$/i.test(lower)) return { intent: "VOLUME_UP", rawText: original };
  if (/^volume down$/i.test(lower)) return { intent: "VOLUME_DOWN", rawText: original };

  /* ================= SEARCH / YOUTUBE ================= */

  if (lower.startsWith("search ")) {
    return {
      intent: "SEARCH",
      query: original.replace(/^search\s+/i, ""),
      rawText: original
    };
  }

  if (lower.startsWith("youtube ")) {
    return {
      intent: "YOUTUBE",
      query: original.replace(/^youtube\s+/i, ""),
      rawText: original
    };
  }

  if (lower === "open youtube") {
    return { intent: "YOUTUBE", query: "", rawText: original };
  }

  /* ================= SYSTEM / APPS ================= */

  if (/^open chrome$/i.test(lower))
    return { intent: "OPEN_APP", app: "chrome", rawText: original };

  if (/^open edge$/i.test(lower))
    return { intent: "OPEN_APP", app: "edge", rawText: original };

  if (/^open notepad$/i.test(lower))
    return { intent: "OPEN_APP", app: "notepad", rawText: original };

  if (/^open calculator$/i.test(lower))
    return { intent: "OPEN_APP", app: "calculator", rawText: original };

  if (/^open calendar$/i.test(lower))
    return { intent: "OPEN_CALENDAR", rawText: original };

  if (/^open downloads$/i.test(lower)) {
    return {
      intent: "OPEN_FOLDER",
      path: "C:\\Users\\athar\\Downloads",
      rawText: original
    };
  }

  if (/^(shutdown|shut down)$/i.test(lower))
    return { intent: "SHUTDOWN", rawText: original };

  if (/^restart$/i.test(lower))
    return { intent: "RESTART", rawText: original };

  if (/^lock$/i.test(lower))
    return { intent: "LOCK", rawText: original };

  if (/^sleep$/i.test(lower))
    return { intent: "SLEEP", rawText: original };

  /* ================= MEMORY WRITE ================= */

  if (lower.startsWith("remember ")) {
    const body = original.replace(/^remember\s+/i, "");
    const match = body.match(/^(.+?)\s+is\s+(.+)$/i);

    if (match) {
      let key = match[1].trim();
      const value = match[2].trim();
      if (/^my name$/i.test(key)) key = "name";

      return { intent: "REMEMBER", key, value, rawText: original };
    }
  }

  /* ================= MEMORY READ ================= */

  if (
    lower.startsWith("what is ") ||
    lower === "who am i" ||
    lower.startsWith("who is ") ||
    lower.startsWith("what does ")
  ) {
    let key = lower
      .replace(/^what is\s+/i, "")
      .replace(/^who am i$/i, "identity")
      .replace(/^who is\s+/i, "")
      .replace(/^what does\s+/i, "")
      .trim();

    return { intent: "RECALL", key, rawText: original };
  }

  /* ================= SMALL TALK ================= */

  if (["hi", "hello", "hey"].includes(lower)) {
    return { intent: "SMALLTALK", rawText: original };
  }

  /* ================= DEFAULT ================= */

  return { intent: "GENERAL_QUESTION", rawText: original };
}

module.exports = classifyIntent;



















// /**
//  * Intent Classifier
//  *
//  * Deterministic, object-safe, memory-safe
//  * NO LLM dependency
//  * NO hallucinated intent jumps
//  */

// function classifyIntent(input) {
//   let original = "";
//   let lower = "";

//   // Accept string OR normalize() object
//   if (typeof input === "string") {
//     original = input.trim();
//     lower = original.toLowerCase();
//   } else if (input && typeof input === "object") {
//     original = String(input.rawText || "").trim();
//     lower = String(input.normalizedText || original).toLowerCase();
//   }

//   if (!original) {
//     return { intent: "GENERAL_QUESTION", rawText: "" };
//   }

//   /* ================= 🔒 HARD BLOCK ================= */
//   // Never allow storing time/date as memory
//   if (
//     lower.startsWith("remember ") &&
//     /\b(time|date)\b/i.test(lower)
//   ) {
//     return { intent: "GENERAL_QUESTION", rawText: original };
//   }

//   /* ================= CONFIRMATION ================= */

//   if (/^(yes|yeah|yep|sure|confirm|do it)$/i.test(lower)) {
//     return { intent: "CONFIRM_YES", rawText: original };
//   }

//   if (/^(no|nope|cancel|don't|do not)$/i.test(lower)) {
//     return { intent: "CONFIRM_NO", rawText: original };
//   }

//   /* ================= SELF INTRODUCTION ================= */

//   if (/^(introduce yourself|who are you|what are you)$/i.test(lower)) {
//     return { intent: "INTRODUCE_SELF", rawText: original };
//   }

//   /* ================= TIME / DATE (ABSOLUTE PRIORITY) ================= */

//   if (
//     lower === "time" ||
//     lower === "current time" ||
//     lower.includes("what time") ||
//     lower.includes("tell me time")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
//   }

//   if (
//     lower === "date" ||
//     lower === "today date" ||
//     lower.includes("today's date") ||
//     lower.includes("what date")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
//   }

//   /* ================= META MEMORY (HOW / WHEN) ================= */

//   if (
//     /how do you (know|remember)/i.test(lower) ||
//     /how did you (know|remember|learn)/i.test(lower) ||
//     /when did i (tell|say)/i.test(lower) ||
//     /how do you (know|remember|learn)/i.test(lower)
//   ) {
//     return {
//       intent: "RECALL",
//       key: "it",
//       meta: true,
//       rawText: original
//     };
//   }

//   /* ================= DAY-BASED MEMORY ================= */

//   if (/what did we talk about today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "conversation", rawText: original };
//   }

//   if (/what did i say today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "user_only", rawText: original };
//   }

//   if (/what do you remember today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "memory", rawText: original };
//   }

//   if (/what happened today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "summary", rawText: original };
//   }

//   /* ================= DATE-SPECIFIC MEMORY ================= */

//   if (
//     /(what happened|what did we talk about|what did i say|what do you remember)\s+on\s+/i.test(lower)
//   ) {
//     return { intent: "EPISODIC_BY_DATE", rawText: original };
//   }

//   /* ================= EPISODIC (NON-DATE) ================= */

//   if (
//     /what did i talk about|what did we chat earlier|previous conversation|earlier conversation/i.test(lower) ||
//     /last time we talked|last conversation|last thing i said/i.test(lower)
//   ) {
//     return { intent: "EPISODIC_RECALL", rawText: original };
//   }

//   /* ================= MEMORY SUMMARY ================= */

//   if (
//     lower === "what do you know about me" ||
//     lower === "what do you about me" || // 🔒 typo-safe
//     lower === "summarize my memory" ||
//     lower.startsWith("what do you know about ") ||
//     lower.startsWith("what do you remember about ")
//   ) {
//     return { intent: "MEMORY_SUMMARY", rawText: original };
//   }

//   /* ================= MEMORY FORGET ================= */

//   if (/^(forget|delete|remove)\b/i.test(lower)) {
//     const key = lower
//       .replace(/^(forget|delete|remove)\s+/i, "")
//       .replace(/^my\s+/i, "")
//       .replace(/\s+is\s+.+$/i, "") // 🔒 remove value part
//       .trim();

//     return {
//       intent: "FORGET",
//       key: key || "it",
//       rawText: original
//     };
//   }

//   /* ================= CONTEXT FOLLOW-UP ================= */

//   if (
//     lower === "what is it" ||
//     lower === "what is that" ||
//     lower === "tell me about it"
//   ) {
//     return { intent: "RECALL", key: "it", rawText: original };
//   }

//   /* ================= SYSTEM / MEDIA ================= */

//   if (/^mute$/i.test(lower)) return { intent: "MUTE", rawText: original };
//   if (/^volume up$/i.test(lower)) return { intent: "VOLUME_UP", rawText: original };
//   if (/^volume down$/i.test(lower)) return { intent: "VOLUME_DOWN", rawText: original };

//   /* ================= SEARCH / YOUTUBE ================= */

//   if (lower.startsWith("search ")) {
//     return {
//       intent: "SEARCH",
//       query: original.replace(/^search\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower.startsWith("youtube ")) {
//     return {
//       intent: "YOUTUBE",
//       query: original.replace(/^youtube\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower === "open youtube") {
//     return { intent: "YOUTUBE", query: "", rawText: original };
//   }

//   /* ================= SYSTEM / APPS ================= */

//   if (/^open chrome$/i.test(lower))
//     return { intent: "OPEN_APP", app: "chrome", rawText: original };

//   if (/^open edge$/i.test(lower))
//     return { intent: "OPEN_APP", app: "edge", rawText: original };

//   if (/^open notepad$/i.test(lower))
//     return { intent: "OPEN_APP", app: "notepad", rawText: original };

//   if (/^open calculator$/i.test(lower))
//     return { intent: "OPEN_APP", app: "calculator", rawText: original };

//   if (/^open calendar$/i.test(lower))
//     return { intent: "OPEN_CALENDAR", rawText: original };

//   if (/^open downloads$/i.test(lower)) {
//     return {
//       intent: "OPEN_FOLDER",
//       path: "C:\\Users\\athar\\Downloads",
//       rawText: original
//     };
//   }

//   if (/^(shutdown|shut down)$/i.test(lower))
//     return { intent: "SHUTDOWN", rawText: original };

//   if (/^restart$/i.test(lower))
//     return { intent: "RESTART", rawText: original };

//   if (/^lock$/i.test(lower))
//     return { intent: "LOCK", rawText: original };

//   if (/^sleep$/i.test(lower))
//     return { intent: "SLEEP", rawText: original };

//   /* ================= MEMORY WRITE ================= */

//   if (lower.startsWith("remember ")) {
//     const body = original.replace(/^remember\s+/i, "");
//     const match = body.match(/^(.+?)\s+is\s+(.+)$/i);

//     if (match) {
//       let key = match[1].trim();
//       const value = match[2].trim();
//       if (/^my name$/i.test(key)) key = "name";

//       return { intent: "REMEMBER", key, value, rawText: original };
//     }
//   }

//   /* ================= MEMORY READ ================= */

//   if (
//     lower.startsWith("what is ") ||
//     lower === "who am i" ||
//     lower.startsWith("who is ") ||
//     lower.startsWith("what does ")
//   ) {
//     let key = lower
//       .replace(/^what is\s+/i, "")
//       .replace(/^who am i$/i, "identity")
//       .replace(/^who is\s+/i, "")
//       .replace(/^what does\s+/i, "")
//       .trim();

//     return { intent: "RECALL", key, rawText: original };
//   }

//   /* ================= SMALL TALK ================= */

//   if (["hi", "hello", "hey"].includes(lower)) {
//     return { intent: "SMALLTALK", rawText: original };
//   }

//   /* ================= DEFAULT ================= */

//   return { intent: "GENERAL_QUESTION", rawText: original };
// }

// module.exports = classifyIntent;
















// /**
//  * Intent Classifier
//  *
//  * Deterministic, object-safe, memory-safe
//  * NO LLM dependency
//  * NO hallucinated intent jumps
//  */

// function classifyIntent(input) {
//   let original = "";
//   let lower = "";

//   // Accept string OR normalize() object
//   if (typeof input === "string") {
//     original = input.trim();
//     lower = original.toLowerCase();
//   } else if (input && typeof input === "object") {
//     original = String(input.rawText || "").trim();
//     lower = String(input.normalizedText || original).toLowerCase();
//   }

//   if (!original) {
//     return { intent: "GENERAL_QUESTION", rawText: "" };
//   }

//   /* ================= CONFIRMATION ================= */

//   if (/^(yes|yeah|yep|sure|confirm|do it)$/i.test(lower)) {
//     return { intent: "CONFIRM_YES", rawText: original };
//   }

//   if (/^(no|nope|cancel|don't|do not)$/i.test(lower)) {
//     return { intent: "CONFIRM_NO", rawText: original };
//   }

//   /* ================= SELF INTRODUCTION ================= */

//   if (/^(introduce yourself|who are you|what are you)$/i.test(lower)) {
//     return { intent: "INTRODUCE_SELF", rawText: original };
//   }

//   /* ================= TIME / DATE (ABSOLUTE PRIORITY) ================= */

//   if (
//     lower === "time" ||
//     lower === "current time" ||
//     lower.includes("what time") ||
//     lower.includes("tell me time")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
//   }

//   if (
//     lower === "date" ||
//     lower === "today date" ||
//     lower.includes("today's date") ||
//     lower.includes("what date")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
//   }

//   /* ================= 🔒 HARD BLOCK: TIME / DATE MEMORY ================= */

//   if (
//     lower.startsWith("remember ") &&
//     /\b(time|date)\b/i.test(lower)
//   ) {
//     return {
//       intent: "GENERAL_QUESTION",
//       rawText: original
//     };
//   }

//   /* ================= 🔑 META MEMORY ================= */

//   if (
//     /how do you (know|remember)/i.test(lower) ||
//     /how did you (know|remember|learn)/i.test(lower)
//   ) {
//     return {
//       intent: "RECALL",
//       key: "it",
//       meta: true,
//       rawText: original
//     };
//   }

//   if (/when did i tell you|when did i say/i.test(lower)) {
//     return {
//       intent: "RECALL",
//       key: "it",
//       meta: true,
//       rawText: original
//     };
//   }

//   /* ================= DAY-BASED MEMORY ================= */

//   if (/what did we talk about today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "conversation", rawText: original };
//   }

//   if (/what did i say today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "user_only", rawText: original };
//   }

//   if (/what do you remember today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "memory", rawText: original };
//   }

//   if (/what happened today/i.test(lower)) {
//     return { intent: "DAY_RECALL", mode: "summary", rawText: original };
//   }

//   if (
//   /what happened on|what did we talk about on|what did i say on|what do you remember on/i.test(lower)
// ) {
//   return { intent: "EPISODIC_BY_DATE", rawText: original };
// }

//   /* ================= EPISODIC MEMORY ================= */

//   if (
//     /what did i talk about|what did we chat earlier|previous conversation|earlier conversation/i.test(lower) ||
//     /last time we talked|last conversation|last thing i said/i.test(lower)
//   ) {
//     return { intent: "EPISODIC_RECALL", rawText: original };
//   }

//   /* ================= MEMORY SUMMARY ================= */

//   if (
//     lower === "what do you know about me" ||
//     lower === "summarize my memory" ||
//     lower.startsWith("what do you know about ") ||
//     lower.startsWith("what do you remember about ")
//   ) {
//     return { intent: "MEMORY_SUMMARY", rawText: original };
//   }

//   /* ================= MEMORY FORGET ================= */

//   if (/^(forget|delete|remove)\b/i.test(lower)) {
//     const key = lower
//       .replace(/^(forget|delete|remove)\s+/i, "")
//       .replace(/^my\s+/i, "")
//       .trim();

//     return {
//       intent: "FORGET",
//       key: key || "it",
//       rawText: original
//     };
//   }

//   /* ================= CONTEXT FOLLOW-UP ================= */

//   if (
//     lower === "what is it" ||
//     lower === "what is that" ||
//     lower === "tell me about it"
//   ) {
//     return { intent: "RECALL", key: "it", rawText: original };
//   }

//   /* ================= SYSTEM / MEDIA ================= */

//   if (/^mute$/i.test(lower)) return { intent: "MUTE", rawText: original };
//   if (/^volume up$/i.test(lower)) return { intent: "VOLUME_UP", rawText: original };
//   if (/^volume down$/i.test(lower)) return { intent: "VOLUME_DOWN", rawText: original };

//   /* ================= SEARCH / YOUTUBE ================= */

//   if (lower.startsWith("search ")) {
//     return {
//       intent: "SEARCH",
//       query: original.replace(/^search\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower.startsWith("youtube ")) {
//     return {
//       intent: "YOUTUBE",
//       query: original.replace(/^youtube\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower === "open youtube") {
//     return { intent: "YOUTUBE", query: "", rawText: original };
//   }

//   /* ================= SYSTEM / APPS ================= */

//   if (/^open chrome$/i.test(lower))
//     return { intent: "OPEN_APP", app: "chrome", rawText: original };

//   if (/^open edge$/i.test(lower))
//     return { intent: "OPEN_APP", app: "edge", rawText: original };

//   if (/^open notepad$/i.test(lower))
//     return { intent: "OPEN_APP", app: "notepad", rawText: original };

//   if (/^open calculator$/i.test(lower))
//     return { intent: "OPEN_APP", app: "calculator", rawText: original };

//   if (/^open calendar$/i.test(lower))
//     return { intent: "OPEN_CALENDAR", rawText: original };

//   if (/^open downloads$/i.test(lower)) {
//     return {
//       intent: "OPEN_FOLDER",
//       path: "C:\\Users\\athar\\Downloads",
//       rawText: original
//     };
//   }

//   if (/^(shutdown|shut down)$/i.test(lower))
//     return { intent: "SHUTDOWN", rawText: original };

//   if (/^restart$/i.test(lower))
//     return { intent: "RESTART", rawText: original };

//   if (/^lock$/i.test(lower))
//     return { intent: "LOCK", rawText: original };

//   if (/^sleep$/i.test(lower))
//     return { intent: "SLEEP", rawText: original };

//   /* ================= MEMORY WRITE ================= */

//   if (lower.startsWith("remember ")) {
//     const body = original.replace(/^remember\s+/i, "");
//     const match = body.match(/^(.+?)\s+is\s+(.+)$/i);

//     if (match) {
//       let key = match[1].trim();
//       const value = match[2].trim();
//       if (/^my name$/i.test(key)) key = "name";

//       return { intent: "REMEMBER", key, value, rawText: original };
//     }
//   }

//   /* ================= MEMORY READ ================= */

//   if (
//     lower.startsWith("what is ") ||
//     lower === "who am i" ||
//     lower.startsWith("who is ") ||
//     lower.startsWith("what does ")
//   ) {
//     let key = lower
//       .replace(/^what is\s+/i, "")
//       .replace(/^who am i$/i, "identity")
//       .replace(/^who is\s+/i, "")
//       .replace(/^what does\s+/i, "")
//       .trim();

//     return { intent: "RECALL", key, rawText: original };
//   }

//   /* ================= SMALL TALK ================= */

//   if (["hi", "hello", "hey"].includes(lower)) {
//     return { intent: "SMALLTALK", rawText: original };
//   }

//   /* ================= MATH ================= */

//   if (
//     lower.startsWith("calculate ") ||
//     (/^[0-9+\-*/().\s=^%]+$/.test(original) && /\d/.test(original))
//   ) {
//     return { intent: "AI_CALCULATE", rawText: original };
//   }

//   /* ================= DEFAULT ================= */

//   return { intent: "GENERAL_QUESTION", rawText: original };
// }

// module.exports = classifyIntent;





















// /**
//  * Intent Classifier
//  * - Object-safe (normalizer compatible)
//  * - Strict system commands
//  * - Episodic + semantic memory aware
//  * - Supports forgetting memory
//  * - Hard-fixes TIME / DATE confusion
//  * - Fixes identity memory grammar
//  * - Prevents LLM misuse for deterministic tasks
//  * - 🔒 Prevents memory hallucination (CRITICAL FIX)
//  */

// function classifyIntent(input) {
//   let original = "";
//   let lower = "";

//   // 🔒 Accept string OR normalize() object
//   if (typeof input === "string") {
//     original = input.trim();
//     lower = original.toLowerCase();
//   } else if (input && typeof input === "object") {
//     original = String(input.rawText || "").trim();
//     lower = String(input.normalizedText || original).toLowerCase();
//   }

//   if (!original) {
//     return { intent: "GENERAL_QUESTION", rawText: "" };
//   }

//   /* ================= CONFIRMATION ================= */

//   if (/^(yes|yeah|yep|sure|confirm|do it)$/i.test(lower)) {
//     return { intent: "CONFIRM_YES", rawText: original };
//   }

//   if (/^(no|nope|cancel|don't|do not)$/i.test(lower)) {
//     return { intent: "CONFIRM_NO", rawText: original };
//   }

// /* ================= SELF INTRODUCTION ================= */

//   if (
//     /^(introduce yourself|who are you|what are you)$/i.test(lower)
//   ) {
//     return { intent: "INTRODUCE_SELF", rawText: original };
//   }
//   /* ================= TIME / DATE (ABSOLUTE PRIORITY) ================= */

//   if (
//     lower === "time" ||
//     lower === "current time" ||
//     lower.includes("what time") ||
//     lower.includes("tell me time")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "TIME", rawText: original };
//   }

//   if (
//     lower === "date" ||
//     lower === "today date" ||
//     lower.includes("today's date") ||
//     lower.includes("what date")
//   ) {
//     return { intent: "LOCAL_SKILL", skill: "DATE", rawText: original };
//   }

//   /* ================= 🔒 MEMORY HALLUCINATION GUARD (NEW) ================= */
//   /* Any claim of remembering MUST go through RECALL */

//   if (
//     /do you remember|you remember|i remember|i recall|you recall/i.test(lower)
//   ) {
//     return { intent: "RECALL", key: "it", rawText: original };
//   }

//   /* ================= EPISODIC MEMORY ================= */

//   if (
//     /what did i talk about|what have we talked about|previous conversation|earlier conversation/i.test(lower) ||
//     /do you remember what i said|do you remember our conversation/i.test(lower) ||
//     /last time we talked|last conversation|last thing i said/i.test(lower)
//   ) {
//     return { intent: "EPISODIC_RECALL", rawText: original };
//   }

//   /* ================= MEMORY SUMMARY ================= */

//   if (
//     lower === "what do you know about me" ||
//     lower === "summarize my memory" ||
//     lower.startsWith("what do you know about ") ||
//     lower.startsWith("what do you remember about ")
//   ) {
//     return { intent: "MEMORY_SUMMARY", rawText: original };
//   }

//   /* ================= MEMORY FORGET ================= */

//   if (/^(forget|delete|remove)\b/i.test(lower)) {
//     const key = lower
//       .replace(/^(forget|delete|remove)\s+/i, "")
//       .replace(/^my\s+/i, "")
//       .trim();

//     return {
//       intent: "FORGET",
//       key: key || "it",
//       rawText: original
//     };
//   }

//   /* ================= CONTEXT FOLLOW-UP ================= */

//   if (
//     lower === "what is it" ||
//     lower === "what is that" ||
//     lower === "tell me about it"
//   ) {
//     return { intent: "RECALL", key: "it", rawText: original };
//   }

//   /* ================= SYSTEM / MEDIA ================= */

//   if (/^mute$/i.test(lower))
//     return { intent: "MUTE", rawText: original };

//   if (/^volume up$/i.test(lower))
//     return { intent: "VOLUME_UP", rawText: original };

//   if (/^volume down$/i.test(lower))
//     return { intent: "VOLUME_DOWN", rawText: original };

//   /* ================= SEARCH / YOUTUBE ================= */

//   if (lower.startsWith("search ")) {
//     return {
//       intent: "SEARCH",
//       query: original.replace(/^search\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower.startsWith("youtube ")) {
//     return {
//       intent: "YOUTUBE",
//       query: original.replace(/^youtube\s+/i, ""),
//       rawText: original
//     };
//   }

//   if (lower === "open youtube") {
//     return { intent: "YOUTUBE", query: "", rawText: original };
//   }

//   /* ================= SYSTEM / APPS ================= */

//   if (/^open chrome$/i.test(lower))
//     return { intent: "OPEN_APP", app: "chrome", rawText: original };

//   if (/^open edge$/i.test(lower))
//     return { intent: "OPEN_APP", app: "edge", rawText: original };

//   if (/^open notepad$/i.test(lower))
//     return { intent: "OPEN_APP", app: "notepad", rawText: original };

//   if (/^open calculator$/i.test(lower))
//     return { intent: "OPEN_APP", app: "calculator", rawText: original };

//   if (/^open calendar$/i.test(lower))
//     return { intent: "OPEN_CALENDAR", rawText: original };

//   if (/^open downloads$/i.test(lower)) {
//     return {
//       intent: "OPEN_FOLDER",
//       path: "C:\\Users\\athar\\Downloads",
//       rawText: original
//     };
//   }

//   if (/^(shutdown|shut down)$/i.test(lower))
//     return { intent: "SHUTDOWN", rawText: original };

//   if (/^restart$/i.test(lower))
//     return { intent: "RESTART", rawText: original };

//   if (/^lock$/i.test(lower))
//     return { intent: "LOCK", rawText: original };

//   if (/^sleep$/i.test(lower))
//     return { intent: "SLEEP", rawText: original };

//   /* ================= MEMORY WRITE ================= */

//   // 🔧 Identity / relationship memory
//   if (
//     lower.startsWith("remember ") &&
//     / is (my )?(mother|father|brother|sister|friend|best friend)/i.test(lower)
//   ) {
//     const value = original.replace(/^remember\s+/i, "").trim();
//     return {
//       intent: "REMEMBER",
//       key: "identity",
//       value,
//       rawText: original
//     };
//   }

//   if (
//     lower.startsWith("remember i am ") ||
//     lower.startsWith("remember that i am ")
//   ) {
//     const value = original.replace(/remember( that)? i am/i, "").trim();
//     return { intent: "REMEMBER", key: "status", value, rawText: original };
//   }

//   if (lower.startsWith("remember ") && lower.includes(" is ")) {
//     const body = original.slice(8);
//     const [key, value] = body.split(" is ");
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
//     lower.startsWith("what is ") ||
//     lower === "who am i" ||
//     lower.startsWith("who is ") ||
//     lower.startsWith("what does ")
//   ) {
//     let key = lower
//       .replace(/^what is\s+/i, "")
//       .replace(/^who am i$/i, "identity")
//       .replace(/^who is\s+/i, "")
//       .replace(/^what does\s+/i, "")
//       .trim();

//     return { intent: "RECALL", key, rawText: original };
//   }
 
//   /* ================= SMALL TALK ================= */

//   if (["hi", "hello", "hey"].includes(lower)) {
//     return { intent: "SMALLTALK", rawText: original };
//   }

//   /* ================= MATH (NO LLM) ================= */

//   if (
//     lower.startsWith("calculate ") ||
//     (/^[0-9+\-*/().\s=^%]+$/.test(original) && /\d/.test(original))
//   ) {
//     return { intent: "AI_CALCULATE", rawText: original };
//   }

//   /* ================= DEFAULT ================= */

//   return { intent: "GENERAL_QUESTION", rawText: original };
// }

// module.exports = classifyIntent;



