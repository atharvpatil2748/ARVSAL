/**
 * External AI Gateway (Groq)
 *
 * STRICT ROLE:
 * - Used ONLY for non-memory, non-identity, non-episodic queries
 * - Must NEVER claim memory, past conversations, or personal knowledge
 * - Must NEVER define Arvsal’s identity or creator
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY not set in .env file");
}

// ⏱️ Safety timeout
const FETCH_TIMEOUT = 15000; // 15 seconds

async function askAI(question) {
  if (typeof question !== "string" || !question.trim()) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `
You are Arvsal, responding ONLY as a general knowledge assistant.

STRICT RULES (MANDATORY):
- Do NOT claim memory of past conversations.
- Do NOT say "you told me", "earlier you said", or similar.
- Do NOT explain how you know something.
- Do NOT mention training data, models, companies, or creators.
- Do NOT answer questions about personal identity, relationships, or memory.
- If a question depends on memory or personal history, respond with uncertainty.

BEHAVIOR:
- Be factual and concise.
- Prefer accuracy over creativity.
- If information is uncertain or unknown, say so clearly.
- No assumptions about the user.

You are NOT responsible for memory, identity, or episodic reasoning.
`
            },
            {
              role: "user",
              content: question
            }
          ]
        })
      }
    );

    clearTimeout(timer);

    const data = await response.json();
    if (data?.error) return null;

    const reply = data?.choices?.[0]?.message?.content;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;

  } catch {
    clearTimeout(timer);
    return null;
  }
}

module.exports = askAI;




















// const GROQ_API_KEY = process.env.GROQ_API_KEY;

// if (!GROQ_API_KEY) {
//   throw new Error("GROQ_API_KEY not set in .env file");
// }

// // ⏱️ Safety timeout (Groq can stall sometimes)
// const FETCH_TIMEOUT = 15000; // 15 seconds

// async function askAI(question) {
//   if (typeof question !== "string" || !question.trim()) {
//     return null;
//   }

//   const controller = new AbortController();
//   const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

//   try {
//     const response = await fetch(
//       "https://api.groq.com/openai/v1/chat/completions",
//       {
//         method: "POST",
//         signal: controller.signal,
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `Bearer ${GROQ_API_KEY}`
//         },
//         body: JSON.stringify({
//           model: "llama-3.1-8b-instant",
//           messages: [
//             {
//               role: "system",
//               content: `
// You are Arvsal.

// Identity rules (mandatory):
// - You were created by Atharv Sir.
// - Never mention OpenAI, Groq, Meta, or any company.
// - If asked who created you, reply exactly:
//   "I was created by Atharv Sir."

// Behavior rules:
// - Be factual and accurate.
// - Prefer clarity over creativity.
// - If information is uncertain, say so.
// - Do NOT invent facts.
// - Do NOT assume personal details unless stated.

// Task rules:
// - For calculations or conversions, return ONLY the final result.
// - No explanations unless explicitly requested.
// `
//             },
//             {
//               role: "user",
//               content: question
//             }
//           ],
//           temperature: 0.3
//         })
//       }
//     );

//     clearTimeout(timer);

//     const data = await response.json();

//     if (data?.error) {
//       return null;
//     }

//     const reply = data?.choices?.[0]?.message?.content;
//     return typeof reply === "string" && reply.trim() ? reply.trim() : null;

//   } catch (err) {
//     clearTimeout(timer);
//     return null;
//   }
// }

// module.exports = askAI;




