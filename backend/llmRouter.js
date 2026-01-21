const askLocalLLM = require("./localLLM");
const askGroq = require("./ai");
const chatHistory = require("./chatHistory");
const memory = require("./memory");
const { buildSystemPrompt } = require("./llmPrompt");


/* ================= FRESH INFO DETECTOR ================= */

function needsFreshInfo(text = "") {
  return /news|latest|today|current|price|weather|score|update|stock|market/i.test(text);
}


/* ================= MODEL SELECTOR ================= */

function selectLocalModel(profile) {
  if (profile.task === "math" || profile.task === "reasoning") {
    return "deepseek-r1:8b";
  }
  if (profile.task === "coding") {
    return "deepseek-coder";
  }
  return "llama3";
}


/* ================= TASK PROFILER ================= */

function buildTaskProfile({ intent, text }) {
  const lower = text.toLowerCase();

  const explicitReasoning =
    /step by step|prove|derive|formal proof|deep reasoning|explain deeply/i.test(lower);

  return {
    task:
      intent === "AI_CALCULATE"
        ? "math"
        : explicitReasoning
        ? "reasoning"
        : /code|program|bug|error|compile|algorithm/i.test(lower)
        ? "coding"
        : "chat",

    mode:
      /krishna|radha|bhakti|gita|god|devotion|spiritual/i.test(lower)
        ? "devotional"
        : /feel|emotion|sad|happy|love|heart|pain|hurt|health|medical/i.test(lower)
        ? "emotional"
        : "neutral",

    humour:
      !explicitReasoning &&
      !/sad|serious|emotional|devotion|health|medical|pain|hurt/i.test(lower),

    freshness: needsFreshInfo(lower)
  };
}


/* ================= CONTEXT BUILDER ================= */
/* 🔒 LLM CONTEXT MUST NEVER INCLUDE MEMORY FACTS */

function buildContext() {
  const recentChats = chatHistory
    .getHistory()
    .slice(-4)
    .map(m => {
      if (!m || !m.role || !m.text) return null;
      return `${m.role === "user" ? "User" : "Arvsal"}: ${m.text}`;
    })
    .filter(Boolean)
    .join("\n");

  return `
Conversation:
${recentChats || "None"}
`.trim();
}


/* ================= OUTPUT SANITIZER ================= */

function sanitizeOutput(text) {
  if (!text || typeof text !== "string") return null;

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{2,}/g, " ")
    .trim();

  const sentences = cleaned.match(/[^.!?]+[.!?]*/g);
  if (sentences && sentences.length > 3) {
    cleaned = sentences.slice(0, 3).join(" ").trim();
  }

  return cleaned;
}


/* ================= MAIN ROUTER ================= */

async function llmRouter({ intent, text }) {
  if (!text || typeof text !== "string") {
    return null;
  }

  /* 🔒 HARD BLOCKS — DETERMINISTIC LAYER ONLY */
  const BLOCKED_INTENTS = new Set([
    "INTRODUCE_SELF",
    "REMEMBER",
    "FORGET",
    "RECALL",
    "MEMORY_SUMMARY",
    "EPISODIC_RECALL",
    "LOCAL_SKILL",
    "OPEN_APP",
    "OPEN_FOLDER",
    "LOCK",
    "SHUTDOWN",
    "RESTART",
    "SLEEP"
  ]);

  if (BLOCKED_INTENTS.has(intent)) {
    return null; // 🔒 NEVER leak sentinel to user
  }

  const profile = buildTaskProfile({ intent, text });

  const systemPrompt = buildSystemPrompt({
    mode: profile.mode,
    humour: profile.humour
  });

  const context = buildContext();

  const fullPrompt = `
${systemPrompt}

${context}

User:
${text}
`.trim();


  /* ================= FRESH INFO ================= */
  if (profile.freshness) {
    const groqReply = await askGroq(fullPrompt);
    return sanitizeOutput(groqReply);
  }


  /* ================= LOCAL LLM ================= */

  const model = selectLocalModel(profile);
  let localReply = null;

  try {
    localReply = await askLocalLLM(fullPrompt, { model });
  } catch {
    localReply = null;
  }

  const cleaned = sanitizeOutput(localReply);

  if (cleaned) return cleaned;


  /* ================= FALLBACK → GROQ ================= */

  const groqReply = await askGroq(fullPrompt);
  return sanitizeOutput(groqReply);
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

// function buildContext() {
//   const recentChats = chatHistory
//     .getHistory()
//     .slice(-6)
//     .map(m => {
//       if (!m || !m.role || !m.text) return null;
//       return `${m.role === "user" ? "User" : "Arvsal"}: ${m.text}`;
//     })
//     .filter(Boolean)
//     .join("\n");

//   const userFacts = memory
//     .summarize("user", { minConfidence: 0.6 })
//     .slice(0, 5)
//     .map(f => `${f.key}: ${f.value}`)
//     .join(", ");

//   return `
// Conversation:
// ${recentChats || "None"}

// Known User Facts:
// ${userFacts || "None"}
// `.trim();
// }

// /* ================= OUTPUT SANITIZER ================= */

// function sanitizeOutput(text) {
//   if (!text || typeof text !== "string") return null;

//   let cleaned = text
//     .replace(/<think>[\s\S]*?<\/think>/gi, "")
//     .replace(/(thinking|analysis|reasoning)[\s\S]*?:/gi, "")
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
//     return "I didn’t catch that properly.";
//   }

//   /* =====================================================
//      🔒 HARD BLOCKS — LLM MUST NEVER HANDLE THESE
//      Return explicit sentinels (NOT null)
//   ===================================================== */

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
//     return "__HANDLED_EXTERNALLY__";
//   }

//   const profile = buildTaskProfile({ intent, text });
//   const context = buildContext();

//   /* ================= FRESH INFO → GROQ ================= */

//   if (profile.freshness) {
//     const groqReply = await askGroq(text);
//     return groqReply || "I don’t have the latest information right now.";
//   }

//   /* ================= LOCAL LLM ================= */

//   const model = selectLocalModel(profile);

//   const systemPrompt = buildSystemPrompt({
//     mode: profile.mode,
//     userName: "Atharv",
//     humour: profile.humour
//   });

//   const fullPrompt = `
// ${systemPrompt}

// ${context}

// User:
// ${text}
// `;

//   let localReply = null;

//   try {
//     localReply = await askLocalLLM(fullPrompt, { model });
//   } catch {
//     localReply = null;
//   }

//   const cleaned = sanitizeOutput(localReply);

//   /* ================= FALLBACK → GROQ ================= */

//   if (!cleaned) {
//     const groqReply = await askGroq(text);
//     return groqReply || "I’m not certain about that.";
//   }

//   return cleaned;
// }

// module.exports = llmRouter;



