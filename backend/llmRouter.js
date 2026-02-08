/**
 * LLM Router (STRICT + DETERMINISTIC + SAFE)
 *
 * - Never throws for AI availability
 * - Never executes system logic
 * - Returns text OR null only
 */

const { runLLM } = require("./llmRunner");
const chatHistory = require("./chatHistory");

const { buildSystemPrompt } = require("./llmPrompt");
const { buildCodePrompt } = require("./codePrompt");
const { buildMathPrompt } = require("./mathPrompt");

const { getActiveAI } = require("./aiSwitch");
const { askChatGPT } = require("./chatgptClient");
const { askGemini } = require("./geminiClient");

const LLM_DEBUG = process.env.LLM_DEBUG === "true";
const debug = (...a) => LLM_DEBUG && console.log("[LLM_DEBUG]", ...a);

/* ================= GUARDS ================= */

const TRIVIAL_JUNK = /^(sure|okay|alright|\.+)$/i;
const CORRUPTED = /�/;

/* ================= UTILS ================= */

function clean(text) {
  if (!text || typeof text !== "string") return null;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function buildContext() {
  return chatHistory
    .getLLMContext(6)
    .map(m => `${m.role === "user" ? "User" : "Arvsal"}: ${m.text}`)
    .join("\n");
}

/* ================= ROUTER ================= */

async function llmRouter({ intent, text }) {
  if (!text) return null;

  debug("Intent:", intent);
  debug("Text:", text);

  /* ---------- PROMPT ---------- */

  let systemPrompt;
  let includeContext = true;

  if (intent === "CODING_QUERY") {
    systemPrompt = buildCodePrompt();
    includeContext = false;
  } else if (intent === "MATH_QUERY") {
    systemPrompt = buildMathPrompt();
    includeContext = false;
  } else {
    systemPrompt = buildSystemPrompt({
      mode: "neutral",
      humour: false,
      noQuestions: true,
      stopOnDone: true
    });
  }

  const prompt = [
    systemPrompt,
    includeContext ? buildContext() : "",
    text
  ].filter(Boolean).join("\n\n");

  const activeAI = getActiveAI();
  debug("Active AI:", activeAI);

  /* ---------- EXTERNAL AI ---------- */

  if (activeAI === "chatgpt") {
    try {
      const out = clean(await askChatGPT(prompt));
      if (out) return out;
    } catch (err) {
      debug("ChatGPT ERROR:", err?.message);
    }
    return null; // ⛔ graceful fail
  }

  if (activeAI === "gemini") {
    try {
      const out = clean(await askGemini(prompt));
      if (out) return out;
    } catch (err) {
      debug("Gemini ERROR:", err?.message);
    }
    return null; // ⛔ graceful fail
  }

  /* ---------- LOCAL AI ---------- */

  let model = "llama3";
  if (intent === "CODING_QUERY") model = "deepseek-coder";
  if (intent === "MATH_QUERY") model = "deepseek-r1:8b";

  let timeout = 20000;
  if (intent === "CODING_QUERY") timeout = 25000;
  if (intent === "MATH_QUERY") timeout = 300000;

  debug("Local model:", model);

  try {
    const raw = await runLLM({ model, prompt, timeout });
    const output = clean(raw);

    debug("Local cleaned:", output);

    if (!output) return null;
    if (CORRUPTED.test(output)) return null;
    if (TRIVIAL_JUNK.test(output)) return null;
    if (!output || output.length < 5) return null;

    // 🚫 Never accept incomplete answers
    if (output && /[,:;(\[]$/.test(output)) {
      return null;
    }

    return output;
  } catch (err) {
    debug("Local LLM ERROR:", err?.message);
    return null;
  }
}

module.exports = llmRouter;
















// const askLocalLLM = require("./localLLM");
// const askGroq = require("./ai");
// const chatHistory = require("./chatHistory");
// const memory = require("./memory");
// const { buildSystemPrompt } = require("./llmPrompt");


// /* ================= FRESH INFO DETECTOR ================= */

// function needsFreshInfo(text = "") {
//   return /news|latest|today|current|price|weather|score|update|stock|market/i.test(text);
// }


// /* ================= MODEL SELECTOR ================= */

// function selectLocalModel(profile) {
//   if (profile.task === "math" || profile.task === "reasoning") {
//     return "deepseek-r1:8b";
//   }
//   if (profile.task === "coding") {
//     return "deepseek-coder";
//   }
//   return "llama3";
// }


// /* ================= TASK PROFILER ================= */

// function buildTaskProfile({ intent, text }) {
//   const lower = text.toLowerCase();

//   const explicitReasoning =
//     /step by step|prove|derive|formal proof|deep reasoning|explain deeply/i.test(lower);

//   return {
//     task:
//       intent === "AI_CALCULATE"
//         ? "math"
//         : explicitReasoning
//         ? "reasoning"
//         : /code|program|bug|error|compile|algorithm/i.test(lower)
//         ? "coding"
//         : "chat",

//     mode:
//       /krishna|radha|bhakti|gita|god|devotion|spiritual/i.test(lower)
//         ? "devotional"
//         : /feel|emotion|sad|happy|love|heart|pain|hurt|health|medical/i.test(lower)
//         ? "emotional"
//         : "neutral",

//     humour:
//       !explicitReasoning &&
//       !/sad|serious|emotional|devotion|health|medical|pain|hurt/i.test(lower),

//     freshness: needsFreshInfo(lower)
//   };
// }


// /* ================= CONTEXT BUILDER ================= */
// /* 🔒 LLM CONTEXT MUST NEVER INCLUDE MEMORY FACTS */

// function buildContext() {
//   const recentChats = chatHistory
//     .getHistory()
//     .slice(-4)
//     .map(m => {
//       if (!m || !m.role || !m.text) return null;
//       return `${m.role === "user" ? "User" : "Arvsal"}: ${m.text}`;
//     })
//     .filter(Boolean)
//     .join("\n");

//   return `
// Conversation:
// ${recentChats || "None"}
// `.trim();
// }


// /* ================= OUTPUT SANITIZER ================= */

// function sanitizeOutput(text) {
//   if (!text || typeof text !== "string") return null;

//   let cleaned = text
//     .replace(/<think>[\s\S]*?<\/think>/gi, "")
//     .replace(/```[\s\S]*?```/g, "")
//     .replace(/\n{2,}/g, " ")
//     .trim();

//   const sentences = cleaned.match(/[^.!?]+[.!?]*/g);
//   if (sentences && sentences.length > 3) {
//     cleaned = sentences.slice(0, 3).join(" ").trim();
//   }

//   return cleaned;
// }


// /* ================= MAIN ROUTER ================= */

// async function llmRouter({ intent, text }) {
//   if (!text || typeof text !== "string") {
//     return null;
//   }

//   /* 🔒 HARD BLOCKS — DETERMINISTIC LAYER ONLY */
//   const BLOCKED_INTENTS = new Set([
//     "INTRODUCE_SELF",
//     "REMEMBER",
//     "FORGET",
//     "RECALL",
//     "MEMORY_SUMMARY",
//     "EPISODIC_RECALL",
//     "LOCAL_SKILL",
//     "OPEN_APP",
//     "OPEN_FOLDER",
//     "LOCK",
//     "SHUTDOWN",
//     "RESTART",
//     "SLEEP"
//   ]);

//   if (BLOCKED_INTENTS.has(intent)) {
//     return null; // 🔒 NEVER leak sentinel to user
//   }

//   const profile = buildTaskProfile({ intent, text });

//   const systemPrompt = buildSystemPrompt({
//     mode: profile.mode,
//     humour: profile.humour
//   });

//   const context = buildContext();

//   const fullPrompt = `
// ${systemPrompt}

// ${context}

// User:
// ${text}
// `.trim();


//   /* ================= FRESH INFO ================= */
//   if (profile.freshness) {
//     const groqReply = await askGroq(fullPrompt);
//     return sanitizeOutput(groqReply);
//   }


//   /* ================= LOCAL LLM ================= */

//   const model = selectLocalModel(profile);
//   let localReply = null;

//   try {
//     localReply = await askLocalLLM(fullPrompt, { model });
//   } catch {
//     localReply = null;
//   }

//   const cleaned = sanitizeOutput(localReply);

//   if (cleaned) return cleaned;


//   /* ================= FALLBACK → GROQ ================= */

//   const groqReply = await askGroq(fullPrompt);
//   return sanitizeOutput(groqReply);
// }

// module.exports = llmRouter;






