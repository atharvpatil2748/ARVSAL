const chatHistory = require("./chatHistory");
const memory = require("./memory");
const askLocalLLM = require("./localLLM");
const normalizeKey = require("./keyNormalizer");
const episodicMemory = require("./episodicMemory");

/* ================= CONFIG ================= */

const REFLECT_WINDOW = 6;
const REFLECT_CONFIDENCE = 0.6;
const MIN_CONFIDENCE_TO_PROTECT = 0.85;
const CONFIDENCE_BOOST = 0.05;

/* ================= SAFETY FILTERS ================= */

// Declarative, factual self-statements only
function isSelfStatement(text) {
  return (
    typeof text === "string" &&
    /\b(i am|i'm|i study|i live|my name is|my college is|my branch is|i work as)\b/i.test(text) &&
    !/\?$/.test(text)
  );
}

// Reject abstract, emotional, devotional, or unstable keys
function looksStableKey(key) {
  return !/(like|love|feel|emotion|belief|thought|dream|hope|wish|philosophy|religion|bhagavad|gita|shlok|verse|krishna|god)/i.test(key);
}

// Only user memory allowed
function isValidSubject(subject) {
  return subject === "user";
}

// Identity & permanent memory must NEVER be reflected
function isProtectedKey(key) {
  return /^(identity|name|relationship|mother|father|system)$/i.test(key);
}

/* ================= REFLECTION TRIGGER ================= */

function shouldReflect() {
  const history = chatHistory.getHistory();
  if (!Array.isArray(history) || history.length < REFLECT_WINDOW) return false;

  const recentUsers = history
    .slice(-REFLECT_WINDOW)
    .filter(m => m.role === "user" && isSelfStatement(m.content));

  return recentUsers.length >= 2;
}

/* ================= JSON EXTRACTOR ================= */

function extractJsonArray(text) {
  if (!text || typeof text !== "string") return null;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* ================= MAIN REFLECTION ================= */

async function reflect() {
  const history = chatHistory.getHistory().slice(-REFLECT_WINDOW);

  const selfStatements = history.filter(
    m => m.role === "user" && isSelfStatement(m.content)
  );

  if (selfStatements.length < 2) return;

  const conversation = selfStatements
    .map(m => `USER: ${m.content}`)
    .join("\n");

  const prompt = `
You are Arvsal's memory reflection system.

Extract ONLY explicit, factual, stable information
that the USER directly stated about themselves.

Rules (STRICT):
- NO inference
- NO identity facts
- NO emotions, beliefs, devotion
- If unsure, return []

Return STRICT JSON ONLY:
[
  { "subject": "user", "key": "string", "value": "string" }
]

Conversation:
${conversation}
`;

  let raw;
  try {
    raw = await askLocalLLM(prompt, { model: "llama3", timeout: 12000 });
  } catch {
    return;
  }

  const extracted = extractJsonArray(raw);
  if (!Array.isArray(extracted) || extracted.length === 0) return;

  for (const item of extracted) {
    let { subject, key, value } = item;

    if (!subject || !key || !value) continue;
    if (!isValidSubject(subject)) continue;

    key = normalizeKey(key);
    value = String(value).trim();

    if (!key || !value) continue;
    if (!looksStableKey(key)) continue;
    if (isProtectedKey(key)) continue;

    const existing = memory.recall("user", key);

    // 🛑 Strong memory protection
    if (existing) {
      // Same value → reinforce confidence ONLY
      if (existing.value.toLowerCase() === value.toLowerCase()) {
        if (existing.confidence < 1) {
          memory.remember({
            subject: "user",
            key,
            value: existing.value,
            confidence: Math.min(1, existing.confidence + CONFIDENCE_BOOST),
            source: existing.source, // 🔒 preserve origin
            category: existing.category || "general"
          });
        }
        continue;
      }

      // Different value but high confidence → reject
      if (existing.confidence >= MIN_CONFIDENCE_TO_PROTECT) {
        continue;
      }
    }

    // 🧠 Store reflected memory (new, weak)
    memory.remember({
      subject: "user",
      key,
      value,
      confidence: REFLECT_CONFIDENCE,
      source: "reflected",
      category: "general"
    });

    // 📌 Episodic trace for explainability
    episodicMemory.store({
      type: "reflection_memory",
      subject: "user",
      key,
      value,
      meta: { source: "reflection" }
    });
  }
}

module.exports = {
  shouldReflect,
  reflect
};
















// const chatHistory = require("./chatHistory");
// const memory = require("./memory");
// const askLocalLLM = require("./localLLM");
// const normalizeKey = require("./keyNormalizer");
// const episodicMemory = require("./episodicMemory"); // ✅ correct import

// /* ================= CONFIG ================= */

// const REFLECT_WINDOW = 6;
// const REFLECT_CONFIDENCE = 0.6;
// const MIN_CONFIDENCE_TO_PROTECT = 0.85;
// const CONFIDENCE_BOOST = 0.05;

// /* ================= SAFETY FILTERS ================= */

// // Must be a declarative self-statement
// function isSelfStatement(text) {
//   return (
//     typeof text === "string" &&
//     /\b(i am|i'm|i study|i live|my name is|my college is|my branch is|i work as)\b/i.test(text) &&
//     !/\?$/.test(text)
//   );
// }

// // Reject abstract / unstable keys
// function looksStableKey(key) {
//   return !/(like|love|feel|emotion|belief|thought|dream|hope|wish|philosophy|religion|bhagavad|gita|shlok|verse|krishna|god)/i.test(key);
// }

// // Only user memory allowed
// function isValidSubject(subject) {
//   return subject === "user";
// }

// /* ================= REFLECTION TRIGGER ================= */

// function shouldReflect() {
//   const history = chatHistory.getHistory();
//   if (!Array.isArray(history) || history.length < REFLECT_WINDOW) return false;

//   const recentUsers = history
//     .slice(-REFLECT_WINDOW)
//     .filter(m => m.role === "user" && isSelfStatement(m.content));

//   // Require at least TWO self-statements
//   return recentUsers.length >= 2;
// }

// /* ================= JSON EXTRACTOR ================= */

// function extractJsonArray(text) {
//   if (!text || typeof text !== "string") return null;

//   const start = text.indexOf("[");
//   const end = text.lastIndexOf("]");
//   if (start === -1 || end === -1 || end <= start) return null;

//   try {
//     const parsed = JSON.parse(text.slice(start, end + 1));
//     return Array.isArray(parsed) ? parsed : null;
//   } catch {
//     return null;
//   }
// }

// /* ================= MAIN REFLECTION ================= */

// async function reflect() {
//   const history = chatHistory.getHistory().slice(-REFLECT_WINDOW);

//   const selfStatements = history.filter(
//     m => m.role === "user" && isSelfStatement(m.content)
//   );

//   if (selfStatements.length < 2) return;

//   /* 🧠 EPISODIC MEMORY — ONE CLEAN EVENT */
//   episodicMemory.store({
//     type: "reflection",
//     subject: "user",
//     value: "User shared stable self-information",
//     meta: {
//       count: selfStatements.length
//     }
//   });

//   const conversation = selfStatements
//     .map(m => `USER: ${m.content}`)
//     .join("\n");

//   const prompt = `
// You are Arvsal's memory reflection system.

// Extract ONLY explicit, factual, stable information
// that the USER directly stated about themselves.

// Rules (STRICT):
// - NO inference or guessing
// - NO emotions, beliefs, opinions, philosophy
// - NO scriptures or devotion
// - If unsure, return []

// Return STRICT JSON ONLY:
// [
//   { "subject": "user", "key": "string", "value": "string" }
// ]

// Conversation:
// ${conversation}
// `;

//   let raw;
//   try {
//     raw = await askLocalLLM(prompt, { model: "llama3", timeout: 12000 });
//   } catch {
//     return;
//   }

//   const extracted = extractJsonArray(raw);
//   if (!Array.isArray(extracted) || extracted.length === 0) return;

//   for (const item of extracted) {
//     let { subject, key, value } = item;

//     if (!subject || !key || !value) continue;
//     if (!isValidSubject(subject)) continue;

//     key = normalizeKey(key);
//     value = String(value).trim();

//     if (!key || !value) continue;
//     if (!looksStableKey(key)) continue;

//     const existing = memory.recall("user", key);

//     // 🔒 Strong memory protection
//     if (existing) {
//       if (existing.value.toLowerCase() === value.toLowerCase()) {
//         if (existing.confidence < 1) {
//           memory.remember({
//             subject: "user",
//             key,
//             value: existing.value,
//             confidence: Math.min(1, existing.confidence + CONFIDENCE_BOOST),
//             source: "reflected",
//             category: existing.category || "general"
//           });
//         }
//         continue;
//       }

//       if (existing.confidence >= MIN_CONFIDENCE_TO_PROTECT) {
//         continue;
//       }
//     }

//     // 🧠 Store reflected memory
//     memory.remember({
//       subject: "user",
//       key,
//       value,
//       confidence: REFLECT_CONFIDENCE,
//       source: "reflected",
//       category: "general"
//     });
//   }
// }

// module.exports = {
//   shouldReflect,
//   reflect
// };





