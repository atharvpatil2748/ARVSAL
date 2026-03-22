/**
 * Intent Classifier (RESTORED + EXTENDED — FINAL)
 *
 * Deterministic
 * NO LLM dependency
 * NO hallucinated intent jumps
 * ALL original intents preserved
 * New features added safely
 * SCREEN_ACTION + SUGGEST_CONTENT added (vision automation layer)
 */

const { resolveDateRange } = require("./dateResolver");
const { classifyScreenIntent } = require("./actionIntentDetector");

function classifyIntent(input) {
  let original = "";
  let lower = "";

  /* ================= NORMALIZATION ================= */

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

  /* ================= EXPLICIT MODES (HIGHEST PRIORITY) ================= */

  if (lower.startsWith("coding time")) {
    return {
      intent: "CODING_QUERY",
      rawText: original.replace(/^coding time\s*/i, "").trim()
    };
  }

  if (lower.startsWith("maths time")) {
    return {
      intent: "MATH_QUERY",
      rawText: original.replace(/^maths time\s*/i, "").trim()
    };
  }
  if (/^(yes|yeah|yep|sure|ok)$/i.test(lower)) {
    return { intent: "CONFIRM_YES", rawText: original };
  }

  if (/^(no|nah|nope|cancel)$/i.test(lower)) {
    return { intent: "CONFIRM_NO", rawText: original };
  }
  /* ================= HARD BLOCK ================= */

  if (lower.startsWith("remember ") && /\b(time|date)\b/i.test(lower)) {
    return { intent: "GENERAL_QUESTION", rawText: original };
  }

  /* ================= CONFIRMATION ================= */

  if (/^(yes|yeah|yep|sure|confirm|do it)$/i.test(lower)) {
    return { intent: "CONFIRM_YES", rawText: original };
  }

  if (/^(no|nope|cancel|don't|do not)$/i.test(lower)) {
    return { intent: "CONFIRM_NO", rawText: original };
  }

  /* ================= AI MODE ================= */

  if (/\b(connect|switch to|use|enable)\b.*\b(chatgpt|gpt)\b/i.test(lower)) {
    return { intent: "CONNECT_CHATGPT", rawText: original };
  }

  if (/\b(connect|switch to|use|enable)\b.*\bgemini\b/i.test(lower)) {
    return { intent: "CONNECT_GEMINI", rawText: original };
  }

  if (/\b(connect|switch to|use|enable)\b.*\bgro[qk]\b/i.test(lower)) {
    return { intent: "CONNECT_GROQ", rawText: original };
  }

  if (/\b(disconnect|switch back|disable)\b.*\b(ai|local|offline)\b/i.test(lower)) {
    return { intent: "DISCONNECT_AI", rawText: original };
  }

  /* ================= SELF ================= */

  if (/^(introduce yourself|who are you|what are you)$/i.test(lower)) {
    return { intent: "INTRODUCE_SELF", rawText: original };
  }

  /* ================= TIME / DATE ================= */

  // ===== TIME (QUESTION ONLY) =====
  if (
    /^(what('?s)?|tell me|current)\s+time\b/i.test(lower) ||
    /\bwhat time is it\b/i.test(lower) ||
    /\btime now\b/i.test(lower)
  ) {
    return {
      intent: "LOCAL_SKILL",
      skill: "TIME",
      rawText: original
    };
  }

  // ===== DATE (QUESTION ONLY) =====
  if (
    /^(what('?s)?|tell me|current)\s+date\b/i.test(lower) ||
    /\btoday('?s)? date\b/i.test(lower)
  ) {
    return {
      intent: "LOCAL_SKILL",
      skill: "DATE",
      rawText: original
    };
  }

  /* ================= WEATHER / NEWS (STRICT) ================= */

  // ===== WEATHER (STRICT QUESTION-ONLY) =====
  if (/\b(weather|temperature|forecast)\b/i.test(lower)) {
    let city = null;

    // common patterns
    const patterns = [
      /\b(weather|temperature)\s+(in|of)\s+([a-z\s]+)/i,
      /\bin\s+([a-z\s]+)\b.*\b(weather|temperature)\b/i
    ];

    for (const p of patterns) {
      const m = lower.match(p);
      if (m) {
        city = m[m.length - 1]
          .replace(/\b(today|now|currently)\b/i, "")
          .trim();
        break;
      }
    }

    return {
      intent: "LOCAL_SKILL",
      skill: "WEATHER",
      city: city || null,
      rawText: original
    };
  }

  // ===== NEWS (QUESTION-ONLY) =====
  if (
    /\b(news|headlines)\b/i.test(lower) &&
    /\b(what|tell|today|latest|current|did you hear)\b/i.test(lower)
  ) {
    return {
      intent: "LOCAL_SKILL",
      skill: "NEWS",
      rawText: original
    };
  }

  /* ================= META MEMORY ================= */

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


  /* ================= EPISODIC MEMORY (DETERMINISTIC) ================= */

  const range = resolveDateRange(lower);

  // Added ^ at the start to ensure it only matches the beginning of the sentence
  const isPastQuery =
    /^(what happened|what did i say|what did we talk|what do you remember|what i said)\b/i.test(lower);

  if (range && isPastQuery) {
    return { intent: "EPISODIC_BY_DATE", rawText: original };
  }

  if (isPastQuery) {
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

    return { intent: "FORGET", key: key || "it", rawText: original };
  }

  /* ================= CONTEXT FOLLOW-UP ================= */

  if (
    lower === "what is it" ||
    lower === "what is that" ||
    lower === "tell me about it"
  ) {
    return { intent: "RECALL", key: "it", rawText: original };
  }

  /* ================= MEMORY WRITE ================= */

  if (/^remember[\s,]+/i.test(lower)) {
    const body = original.replace(/^remember[\s,]+/i, "");
    const match = body.match(/^(.+?)\s+is\s+(.+)$/i);

    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // 🔒 Remove trailing punctuation only
      value = value.replace(/[.,!?]+$/, "").trim();
      if (/^my name$/i.test(key)) key = "name";
      return { intent: "REMEMBER", key, value, rawText: original };
    }
  }

  /* ================= SCREEN ACTION (vision automation layer) — CHECK BEFORE RECALL ================= */
  // IMPORTANT: Must run before the broad "what is" MEMORY READ block below,
  // so commands like "type hello in the input box" aren't misrouted to RECALL.

  if (/suggest (a |some )?(reply|response|message|content|something)/i.test(lower) ||
    /write something (for|here|in)/i.test(lower) ||
    /improve this (text|message|email)/i.test(lower)) {
    return { intent: "SUGGEST_CONTENT", rawText: original };
  }

  {
    const screenIntentEarly = classifyScreenIntent(original);
    if (screenIntentEarly.type === "screen_action") {
      return { intent: "SCREEN_ACTION", rawText: original };
    }
    if (screenIntentEarly.type === "mixed") {
      return { intent: "SCREEN_ACTION_MIXED", rawText: original };
    }
  }

  /* ================= MEMORY READ ================= */

  if (
    lower === "who am i" ||
    lower.startsWith("who is ") ||
    lower.startsWith("what is my ") ||
    lower.startsWith("what is ") ||
    lower === "what is it" ||
    lower === "what is that"
  ) {
    let key;

    if (lower === "who am i") {
      key = "identity";

    } else if (lower.startsWith("who is ")) {
      key = lower.replace(/^who is\s+/i, "").trim();

    } else if (lower.startsWith("what is my ")) {
      key = lower.replace(/^what is my\s+/i, "").trim();

    } else if (lower.startsWith("what is ")) {
      key = lower.replace(/^what is\s+/i, "").trim();

    } else {
      key = "it";
    }

    return { intent: "RECALL", key, rawText: original };
  }
  /* ================= SYSTEM ================= */

  if (/^mute$/i.test(lower)) return { intent: "MUTE", rawText: original };
  if (/^volume up$/i.test(lower)) return { intent: "VOLUME_UP", rawText: original };
  if (/^volume down$/i.test(lower)) return { intent: "VOLUME_DOWN", rawText: original };

  /* ================= SEARCH / YOUTUBE ================= */

  if (lower.startsWith("search "))
    return { intent: "SEARCH", query: original.replace(/^search\s+/i, ""), rawText: original };

  if (lower.startsWith("youtube "))
    return { intent: "YOUTUBE", query: original.replace(/^youtube\s+/i, ""), rawText: original };

  if (lower === "open youtube")
    return { intent: "YOUTUBE", query: "", rawText: original };

  /* ================= SYSTEM / APPS ================= */

  if (/^open chrome$/i.test(lower)) return { intent: "OPEN_APP", app: "chrome", rawText: original };
  if (/^open edge$/i.test(lower)) return { intent: "OPEN_APP", app: "edge", rawText: original };
  if (/^open notepad$/i.test(lower)) return { intent: "OPEN_APP", app: "notepad", rawText: original };
  if (/^open calculator$/i.test(lower)) return { intent: "OPEN_APP", app: "calculator", rawText: original };
  if (/^open calendar$/i.test(lower)) return { intent: "OPEN_CALENDAR", rawText: original };
  if (/^open downloads$/i.test(lower)) return { intent: "OPEN_FOLDER", path: "C:\\Users\\athar\\Downloads", rawText: original };
  if (/^open whatsapp$/i.test(lower)) return { intent: "OPEN_APP", app: "whatsapp", rawText: original };
  if (/^(shutdown|shut down)$/i.test(lower)) return { intent: "SHUTDOWN", rawText: original };
  if (/^restart$/i.test(lower)) return { intent: "RESTART", rawText: original };
  if (/^lock the system$/i.test(lower)) return { intent: "LOCK", rawText: original };
  if (/^sleep$/i.test(lower)) return { intent: "SLEEP", rawText: original };
  if (/^(snap|photo|camera|webcam|see the room|eye)$/i.test(lower)) { return { intent: "WEBCAM_SNAP", rawText: original }; }




  /* ================= SMALL TALK ================= */

  if (["hi", "hello", "hey"].includes(lower)) {
    return { intent: "SMALLTALK", rawText: original };
  }

  /* ================= SCREEN ACTION (vision automation layer) ================= */
  // NOTE: placed before GENERAL_QUESTION so screen commands are routed correctly.
  // All existing specific intents above take priority.

  // Suggestion commands (screen-driven, confirm before typing)
  if (/suggest (a |some )?(reply|response|message|content|something)/i.test(lower) ||
    /write something (for|here|in)/i.test(lower) ||
    /improve this (text|message|email)/i.test(lower)) {
    return { intent: "SUGGEST_CONTENT", rawText: original };
  }

  // Screen action or mixed
  const screenIntent = classifyScreenIntent(original);
  if (screenIntent.type === "screen_action") {
    return { intent: "SCREEN_ACTION", rawText: original };
  }
  if (screenIntent.type === "mixed") {
    return { intent: "SCREEN_ACTION_MIXED", rawText: original };
  }

  /* ================= DEFAULT ================= */

  return { intent: "GENERAL_QUESTION", rawText: original };
}

module.exports = classifyIntent;


