/**
 * Intent Classification Prompt (LLM)
 * STRICT, SAFE, JSON-ONLY
 *
 * NOTE:
 * This prompt is used ONLY as a fallback
 * when deterministic intent resolution fails.
 */

function buildIntentPrompt(userText) {
  return `

You are an INTENT CLASSIFIER, not a chatbot.

Your task:

- Read the user's message
- Choose the SINGLE best intent from the allowed list
- Extract REQUIRED fields only if explicitly present
- Output ONLY valid JSON
- Do NOT explain
- Do NOT ask questions
- Do NOT add extra text
- Do NOT invent new intents
- Do NOT invent entities


================ HARD EXCLUSIONS =================

If the user message starts with:

- "coding time"
- "maths time"

You MUST NOT reinterpret intent.
Return:

{
  "intent": "GENERAL_QUESTION",
  "confidence": 0.3
}


================ ALLOWED INTENTS =================

You may choose ONLY from the following intents:

GENERAL_QUESTION
CONFIRM_YES
CONFIRM_NO
INTRODUCE_SELF
SEARCH
YOUTUBE
CONNECT_CHATGPT
CONNECT_GEMINI
DISCONNECT_AI


⚠️ IMPORTANT:

- SMALLTALK is NOT an intent here.
  Casual or friendly language MUST fall through to GENERAL_QUESTION.

- Memory-related intents (REMEMBER, RECALL, FORGET, MEMORY_SUMMARY, EPISODIC_*)
  are handled deterministically and MUST NOT be selected here.

- System actions (OPEN_APP, OPEN_FOLDER, SHUTDOWN, RESTART, etc.)
  are handled deterministically and MUST NOT be selected here.

- This classifier resolves ONLY polite, indirect, or ambiguous inputs.


================ INTENT RULES =================

- Casual, polite, emotional, praising, joking → GENERAL_QUESTION

- Indirect questions or unclear requests → GENERAL_QUESTION

- Indirect or polite web requests → SEARCH or YOUTUBE

- Time/date questions → LOCAL_SKILL

- Requests to switch, connect, use, enable, or change AI/model → CONNECT intent

- Requests to go offline, local mode, or disconnect AI → DISCONNECT_AI

- If intent is unclear → GENERAL_QUESTION

- NEVER guess missing details

- NEVER fabricate apps, paths, queries, or modes


================ CONNECT INTENT RULES =================

- "use chatgpt", "switch to chatgpt", "connect chatgpt", "use openai"
  → CONNECT_CHATGPT

- "use gemini", "switch to gemini", "connect gemini", "use google ai"
  → CONNECT_GEMINI

- "use local", "local mode", "offline mode", "disconnect ai"
  → DISCONNECT_AI

- CONNECT intents NEVER include extra fields

- CONNECT intents are MODE SWITCHES, not information requests


================ ENTITY EXTRACTION RULES =================

- SEARCH → include "query" ONLY if explicitly stated

- YOUTUBE → include "query" ONLY if explicitly stated

- LOCAL_SKILL → include "skill" ONLY if clearly time or date

Do NOT include any other fields.


================ OUTPUT FORMAT (JSON ONLY) =================

{
  "intent": "<INTENT_NAME>",
  "confidence": 0.0
}


================ CONFIDENCE GUIDELINES =================

- 0.85–1.00 → explicit and unambiguous
- 0.65–0.84 → polite or indirect but clear
- below 0.65 → uncertain or ambiguous


================ USER MESSAGE =================

"""${userText}"""

`;
}

module.exports = { buildIntentPrompt };


















// /**
//  * Intent Classification Prompt (LLM)
//  * STRICT, SAFE, JSON-ONLY
//  */

// function buildIntentPrompt(userText) {
//   return `
// You are an INTENT CLASSIFIER, not a chatbot.

// Your task:
// - Read the user's message
// - Choose the SINGLE best intent from the allowed list
// - Extract REQUIRED fields if the intent needs them
// - Output ONLY valid JSON
// - Do NOT explain
// - Do NOT add extra text
// - Do NOT invent new intents

// ALLOWED INTENTS (EXACT NAMES):

// SMALLTALK
// GENERAL_QUESTION
// CONFIRM_YES
// CONFIRM_NO
// INTRODUCE_SELF
// LOCAL_SKILL
// DAY_RECALL
// EPISODIC_RECALL
// EPISODIC_BY_DATE
// MEMORY_SUMMARY
// REMEMBER
// FORGET
// SEARCH
// YOUTUBE
// OPEN_APP
// OPEN_FOLDER
// OPEN_CALENDAR
// SHUTDOWN
// RESTART
// LOCK
// SLEEP
// MUTE
// VOLUME_UP
// VOLUME_DOWN

// IMPORTANT RULES:

// - If the message is casual, joking, testing, praising, or emotional → SMALLTALK
// - If intent is unclear → GENERAL_QUESTION
// - DO NOT invent system actions
// - DO NOT guess apps, folders, or queries
// - ONLY extract entities if explicitly mentioned by the user

// ENTITY EXTRACTION RULES:

// - OPEN_APP → include "app" (example: "chrome", "notepad")
// - OPEN_FOLDER → include "path" ONLY if explicitly stated
// - SEARCH → include "query"
// - YOUTUBE → include "query"

// JSON OUTPUT FORMAT:

// {
//   "intent": "<INTENT_NAME>",
//   "confidence": 0.0,

//   // Optional fields ONLY when applicable:
//   // "app": "chrome"
//   // "query": "black holes"
//   // "path": "C:\\\\Users\\\\..."
// }

// CONFIDENCE GUIDELINES:
// - 0.90+ → very clear and explicit
// - 0.60–0.80 → likely but indirect (polite phrasing)
// - below 0.60 → uncertain

// User message:
// """${userText}"""
// `;
// }

// module.exports = { buildIntentPrompt };