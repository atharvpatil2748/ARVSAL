/**
 * Intent Classification Prompt (LLM)
 * STRICT, SAFE, JSON-ONLY
 */

function buildIntentPrompt(userText) {
  return `
You are an INTENT CLASSIFIER, not a chatbot.

Your task:
- Read the user's message
- Choose the SINGLE best intent from the allowed list
- Extract REQUIRED fields if the intent needs them
- Output ONLY valid JSON
- Do NOT explain
- Do NOT add extra text
- Do NOT invent new intents

ALLOWED INTENTS (EXACT NAMES):

SMALLTALK
GENERAL_QUESTION
CONFIRM_YES
CONFIRM_NO
INTRODUCE_SELF
LOCAL_SKILL
DAY_RECALL
EPISODIC_RECALL
EPISODIC_BY_DATE
MEMORY_SUMMARY
REMEMBER
FORGET
SEARCH
YOUTUBE
OPEN_APP
OPEN_FOLDER
OPEN_CALENDAR
SHUTDOWN
RESTART
LOCK
SLEEP
MUTE
VOLUME_UP
VOLUME_DOWN

IMPORTANT RULES:

- If the message is casual, joking, testing, praising, or emotional → SMALLTALK
- If intent is unclear → GENERAL_QUESTION
- DO NOT invent system actions
- DO NOT guess apps, folders, or queries
- ONLY extract entities if explicitly mentioned by the user

ENTITY EXTRACTION RULES:

- OPEN_APP → include "app" (example: "chrome", "notepad")
- OPEN_FOLDER → include "path" ONLY if explicitly stated
- SEARCH → include "query"
- YOUTUBE → include "query"

JSON OUTPUT FORMAT:

{
  "intent": "<INTENT_NAME>",
  "confidence": 0.0,

  // Optional fields ONLY when applicable:
  // "app": "chrome"
  // "query": "black holes"
  // "path": "C:\\\\Users\\\\..."
}

CONFIDENCE GUIDELINES:
- 0.90+ → very clear and explicit
- 0.60–0.80 → likely but indirect (polite phrasing)
- below 0.60 → uncertain

User message:
"""${userText}"""
`;
}

module.exports = { buildIntentPrompt };