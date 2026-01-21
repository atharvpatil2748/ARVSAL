/**
 * Personality Layer
 * FINAL AUTHORITY GATE
 *
 * - LLM is OPTIONAL
 * - Memory & system replies are SACRED
 */

const { enhanceWithLLM } = require("./personalityLLM");

let replyCount = 0;
let lastAddressedAt = 0;
const ADDRESS_NAME = "Sir";

// intents / replies that must NEVER be rewritten
const HARD_NO_LLM = /(your .* is|you told me|stored as memory|explicit memory|today,|on .* we talked|i don’t have|i don't have|are you sure|opening|system locked|volume|searching|forgotten)/i;

async function applyPersonality(text) {
  if (typeof text !== "string") text = String(text ?? "");
  text = text.trim();
  if (!text) return "I’m not sure about that.";

  // Remove leakage
  text = text.replace(/^(arvsal\s*:\s*)+/i, "");

  replyCount++;
  const lower = text.toLowerCase();

  // 🔒 ABSOLUTE NO-LLM ZONE
  if (HARD_NO_LLM.test(lower)) {
    return maybeAddress(ensurePunctuation(text));
  }

  // very short replies → keep simple
  if (text.length <= 12) {
    return maybeAddress(ensurePunctuation(text));
  }

  let finalText = text;

  // 🧠 Allow LLM ONLY for conversational polish
  try {
    finalText = await enhanceWithLLM(text);
  } catch {
    finalText = text;
  }

  return maybeAddress(ensurePunctuation(finalText));
}

/* ================= ADDRESSING ================= */

function maybeAddress(text) {
  const shouldAddress =
    replyCount - lastAddressedAt >= 2 &&
    Math.random() < 0.4 &&
    !/^sir[, ]/i.test(text);

  if (shouldAddress) {
    lastAddressedAt = replyCount;
    return `${ADDRESS_NAME}, ${text}`;
  }
  return text;
}

/* ================= HELPERS ================= */

function ensurePunctuation(text) {
  return /[.!?]$/.test(text) ? text : text + ".";
}

module.exports = applyPersonality;














// /**
//  * Personality Layer
//  * Final response gate before speaking
//  * Deterministic, human, non-robotic
//  */

// let responseCount = 0;
// const USER_ADDRESS = "Atharv Sir";

// function applyPersonality(text) {
//   if (typeof text !== "string") text = String(text ?? "");
//   text = text.trim();

//   if (!text) return "I’m not sure about that.";

//   // Remove self-name leakage
//   text = text.replace(/^(arvsal\s*:\s*)+/i, "");

//   // Absolute identity lock
//   if (text.startsWith("I am Arvsal —")) return text;

//   const lower = text.toLowerCase();

//   /* =====================================================
//      🔒 Epistemic / memory statements — DO NOT MODIFY
//   ===================================================== */
//   if (
//     /(i don’t know|i do not know|i am not sure|i recall|i remember|you told me|stored as memory|explicit memory|when you told me)/i.test(
//       lower
//     )
//   ) {
//     responseCount++;
//     return /[.!?]$/.test(text) ? text : text + ".";
//   }

//   /* =====================================================
//      🧠 Explicit explanation / length requests
//      → NEVER trim these
//   ===================================================== */
//   const explicitLengthRequest =
//     /(in\s+\d+\s+sentences|explain|describe|in detail|tell me more|elaborate)/i.test(
//       lower
//     );

//   /* =====================================================
//      💙 Emotional user input → gentle expansion
//   ===================================================== */
//   const emotionalInput =
//     /(tired|sad|exhausted|hectic|stress|stressed|happy|upset|bad day|long day)/i.test(
//       lower
//     );

//   if (emotionalInput && !explicitLengthRequest) {
//     responseCount++;
//     const suffix =
//       " Sir, that can really drain your energy. Take a moment to breathe and give yourself some rest—you deserve it.";
//     return (
//       text +
//       (/[.!?]$/.test(text) ? "" : ".") +
//       suffix
//     );
//   }

//   /* =====================================================
//      ✂️ Soft sentence cap (ONLY if not explicitly requested)
//   ===================================================== */
//   if (!explicitLengthRequest) {
//     const sentences = text.match(/[^.!?]+[.!?]*/g);
//     if (sentences && sentences.length > 3) {
//       text = sentences.slice(0, 3).join(" ").trim();
//     }
//   }

//   /* =====================================================
//      👑 Addressing cadence (every ~3 responses)
//      Natural, not mechanical
//   ===================================================== */
//   responseCount++;

//   const shouldAddress =
//     responseCount % 3 === 0 &&      // cadence
//     text.length > 40 &&             // avoid tiny replies
//     !emotionalInput;                // never during emotions

//   if (shouldAddress) {
//     text = `${USER_ADDRESS}, ${text}`;
//   }

//   // Final punctuation guarantee
//   if (!/[.!?]$/.test(text)) text += ".";

//   return text;
// }

// module.exports = applyPersonality;


