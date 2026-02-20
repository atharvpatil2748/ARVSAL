/**
 * LLM Router (STRICT + DETERMINISTIC + SAFE)
 *
 * - Never throws for AI availability
 * - Never executes system logic
 * - Returns text OR null only
 */

const { runLLM } = require("./llmRunner");
const chatHistory = require("./chatHistory");
const { processMemoryQuery } = require("./cognitiveEngine");

const { buildSystemPrompt } = require("./llmPrompt");
const { buildCodePrompt } = require("./codePrompt");
const { buildMathPrompt } = require("./mathPrompt");

const { getActiveAI, markAIUnavailable } = require("./aiSwitch"); // <--- Add markAIUnavailable here
const { askChatGPT } = require("./chatgptClient");
const { askGemini } = require("./geminiClient");
const { askGroq } = require("./groqClient");

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

async function llmRouter({ intent, text, modelOverride = null }) {
  if (!text) return null;

  debug("Intent:", intent);
  debug("Text:", text);

  /* ---------- PROMPT ---------- */

  let systemPrompt;
  let includeContext = true;

  if (intent === "CODING_QUERY") {
    systemPrompt = buildCodePrompt();
    includeContext = false;
  } 
  else if (intent === "MATH_QUERY") {
    systemPrompt = buildMathPrompt();
    includeContext = false;
  } 
  else if (intent === "EPISODIC_SUMMARY") {
    systemPrompt = `
You are a historical log summarizer.
You replay events exactly as written.
Use only provided content.
Past tense only.
Refer to user as "you".
No analysis.
No speculation.
No commentary.
`;
    includeContext = false;
  } 
  else {
    systemPrompt = buildSystemPrompt({
      mode: "neutral",
      humour: false,
      noQuestions: true,
      stopOnDone: true
    });
  }

  /* ---------- DETERMINE MODEL FIRST ---------- */

  let model = modelOverride || "llama3";
  if (intent === "CODING_QUERY") model = "deepseek-coder";
  if (intent === "MATH_QUERY") model = "deepseek-r1:8b";

  /* ---------- MEMORY INJECTION (ONLY LOCAL LLAMA3 CHAT) ---------- */

  let memoryBlock = "";

  if (model === "llama3" && intent === "GENERAL_QUESTION") {
    try {
      const cognitive = await processMemoryQuery({ text });

      if (cognitive && cognitive.relevantMemory?.length) {

        const semantic = [];
        const episodic = [];
        const reflection = [];
        const vector = [];

        for (const m of cognitive.relevantMemory.slice(0, 8)) {
          if (m.type === "semantic") semantic.push(m.value);
          else if (m.type === "episodic") episodic.push(m.value);
          else if (m.type === "reflection") reflection.push(m.value);
          else if (m.type === "vector") vector.push(m.value);
        }

        const sections = [];

        if (semantic.length) {
          sections.push(
            `[KNOWN FACTS]\n` +
            semantic.map(v => `• ${v}`).join("\n")
          );
        }

        if (episodic.length) {
          sections.push(
            `[PAST CONVERSATIONS]\n` +
            episodic.map(v => `• ${v}`).join("\n")
          );
        }

        if (reflection.length) {
          sections.push(
            `[PATTERNS ABOUT USER]\n` +
            reflection.map(v => `• ${v}`).join("\n")
          );
        }

        if (vector.length) {
          sections.push(
            `[RELATED MEMORIES]\n` +
            vector.map(v => `• ${v}`).join("\n")
          );
        }

        memoryBlock = `
  The following background information may help you respond naturally.
  Use it only if relevant. Do not mention this section.

  ${sections.join("\n\n")}
  `;
      }

    } catch (err) {
      debug("Memory injection error:", err?.message);
    }
  }

  /* ---------- BUILD PROMPT ---------- */

  const prompt = [
    systemPrompt,
    memoryBlock,
    includeContext ? buildContext() : "",
    text
  ]
    .filter(Boolean)
    .join("\n\n");

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
    return null;
  }

  if (activeAI === "gemini") {
    try {
      const out = clean(await askGemini(prompt));
      if (out) return out;
    } catch (err) {
      debug("Gemini ERROR:", err?.message);
    }
    return null;
  }

  if (activeAI === "groq") {
    try {
      const out = clean(await askGroq(prompt));
      if (out) return out;
    } catch (err) {
      debug("Groq ERROR:", err?.message);
      markAIUnavailable("groq");
    }
    return null;
  }

  /* ---------- LOCAL AI ---------- */

  let timeout = 30000;
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
    if (output.length < 5) return null;
    if (/[,:;(\[]$/.test(output)) return null;

    return output;

  } catch (err) {
    debug("Local LLM ERROR:", err?.message);
    return null;
  }
}

module.exports = llmRouter;














// /**
//  * LLM Router (STRICT + DETERMINISTIC + SAFE)
//  *
//  * - Never throws for AI availability
//  * - Never executes system logic
//  * - Returns text OR null only
//  */

// const { runLLM } = require("./llmRunner");
// const chatHistory = require("./chatHistory");

// const { buildSystemPrompt } = require("./llmPrompt");
// const { buildCodePrompt } = require("./codePrompt");
// const { buildMathPrompt } = require("./mathPrompt");

// const { getActiveAI, markAIUnavailable } = require("./aiSwitch"); // <--- Add markAIUnavailable here
// const { askChatGPT } = require("./chatgptClient");
// const { askGemini } = require("./geminiClient");
// const { askGroq } = require("./groqClient");

// const LLM_DEBUG = process.env.LLM_DEBUG === "true";
// const debug = (...a) => LLM_DEBUG && console.log("[LLM_DEBUG]", ...a);

// /* ================= GUARDS ================= */

// const TRIVIAL_JUNK = /^(sure|okay|alright|\.+)$/i;
// const CORRUPTED = /�/;

// /* ================= UTILS ================= */

// function clean(text) {
//   if (!text || typeof text !== "string") return null;
//   return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
// }

// function buildContext() {
//   return chatHistory
//     .getLLMContext(6)
//     .map(m => `${m.role === "user" ? "User" : "Arvsal"}: ${m.text}`)
//     .join("\n");
// }

// /* ================= ROUTER ================= */

// async function llmRouter({ intent, text, modelOverride = null }) {
//   if (!text) return null;

//   debug("Intent:", intent);
//   debug("Text:", text);

//   /* ---------- PROMPT ---------- */

//   let systemPrompt;
//   let includeContext = true;

//   if (intent === "CODING_QUERY") {
//     systemPrompt = buildCodePrompt();
//     includeContext = false;
//   } else if (intent === "MATH_QUERY") {
//     systemPrompt = buildMathPrompt();
//     includeContext = false;
//   } else if (intent === "EPISODIC_SUMMARY") {
//     systemPrompt = `
//   You are a historical log summarizer.

//   You are NOT chatting.
//   You are NOT thinking.
//   You are replaying events exactly as written.

//   - Use only provided content.
//   - Past tense only.
//   - Refer to the user as "you".
//   - No compression.
//   - No omissions.
//   - No speculation.
//   - No commentary.
//   - No memory disclaimers.
//   - Never describe this as a log.
//   - Never explain that you are summarizing.
//   - Never mention memory limitations.
//   - Never analyze.
//   - Never interpret.
//   - Never speculate.
//   - Do NOT add information.
//   `;

//     includeContext = false;

//   } else {
//     systemPrompt = buildSystemPrompt({
//       mode: "neutral",
//       humour: false,
//       noQuestions: true,
//       stopOnDone: true
//     });
//   }

//   const prompt = [
//     systemPrompt,
//     includeContext ? buildContext() : "",
//     text
//   ].filter(Boolean).join("\n\n");

//   const activeAI = getActiveAI();
//   debug("Active AI:", activeAI);

//   /* ---------- EXTERNAL AI ---------- */

//   if (activeAI === "chatgpt") {
//     try {
//       const out = clean(await askChatGPT(prompt));
//       if (out) return out;
//     } catch (err) {
//       debug("ChatGPT ERROR:", err?.message);
//     }
//     return null; // ⛔ graceful fail
//   }

//   if (activeAI === "gemini") {
//     try {
//       const out = clean(await askGemini(prompt));
//       if (out) return out;
//     } catch (err) {
//       debug("Gemini ERROR:", err?.message);
//     }
//     return null; // ⛔ graceful fail
//   }

//   if (activeAI === "groq") {
//     try {
//       const out = clean(await askGroq(prompt));
//       if (out) return out;
//     } catch (err) {
//       debug("Groq ERROR:", err?.message);
//       markAIUnavailable("groq");
//     }
//     return null; // ⛔ graceful fail
//   }

//   /* ---------- LOCAL AI ---------- */

//  let model = modelOverride || "llama3";
//   if (intent === "CODING_QUERY") model = "deepseek-coder";
//   if (intent === "MATH_QUERY") model = "deepseek-r1:8b";

//   let timeout = 20000;
//   if (intent === "CODING_QUERY") timeout = 25000;
//   if (intent === "MATH_QUERY") timeout = 300000;

//   debug("Local model:", model);

//   try {
//     const raw = await runLLM({ model, prompt, timeout });
//     const output = clean(raw);

//     debug("Local cleaned:", output);

//     if (!output) return null;
//     if (CORRUPTED.test(output)) return null;
//     if (TRIVIAL_JUNK.test(output)) return null;
//     if (!output || output.length < 5) return null;

//     // 🚫 Never accept incomplete answers
//     if (output && /[,:;(\[]$/.test(output)) {
//       return null;
//     }

//     return output;
//   } catch (err) {
//     debug("Local LLM ERROR:", err?.message);
//     return null;
//   }
// }

// module.exports = llmRouter;












