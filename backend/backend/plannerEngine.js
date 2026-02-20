/**
 * Planner Engine – Memory-Aware Agentic Brain
 *
 * - Always memory aware
 * - Strict JSON output
 * - Deterministic
 * - Validated
 * - Production safe
 */

const { runLLM } = require("./llmRunner");
const { processMemoryQuery } = require("./cognitiveEngine");

const MODEL = "arvsal-planner";
const TIMEOUT = 120000;

const MAX_MEMORY_ITEMS = 8;

/* ================= PROMPT ================= */

function buildPlannerPrompt(userInput, memoryContext) {
  return `
You are a STRICT AI planning engine.

Your job:
Convert the user request into a structured execution plan.

==========================
ACTION DETECTION RULE
==========================

Only generate a plan if the user is requesting
a REAL WORLD EXECUTABLE ACTION such as:

- Opening apps
- Closing apps
- Locking system
- Typing text
- Clicking UI
- Opening URLs
- Triggering automation

If the request is:
- Emotional
- Conversational
- Advice seeking
- Informational
- Thinking statement
- Story
- Reflection
- Planning mentally

You MUST return:

{
  "goal": "unclear",
  "steps": [],
  "risk": "low"
}

CRITICAL RULES:
- Output ONLY valid JSON.
- No markdown.
- No explanations.
- No comments.
- No natural language outside JSON.
- No trailing commas.
- Never output "Thinking".
- Never describe reasoning.

==========================
AVAILABLE TOOLS
==========================

1) "system"
Purpose:
- Open desktop applications
- Open URLs
- Safe system-level operations

Allowed actions:
- "open_app"     → params: { "name": "app_name" }
- "close_app"    → params: { "name": "app_name" }
- "open_url"     → params: { "url": "https://example.com" }
- "lock"         → params: {}
- "lock_after"   → params: { "minutes": number }

Examples:
- Open Notepad → system + open_app + { name: "notepad" }
- Open Chrome  → system + open_app + { name: "chrome" }
- Close Notepad → system + close_app + { name: "notepad" }
- Close Chrome  → system + close_app + { name: "chrome" }
- Close Task manager  → system + close_app + { name: "tskmgr" }
- Lock PC      → system + lock + {}
- Lock in 5 min → system + lock_after + { minutes: 5 }

IMPORTANT:
- Always use "system" for launching applications.
- Never use "desktop" to open applications.
- Never use "desktop" for locking.
-For opening a website:
  - ALWAYS use "system" + "open_url"
  - NEVER open browser and type URL manually.
  - NEVER use desktop tool for navigation.

------------------------------------------------

2) "desktop"
Purpose:
- UI interaction only
- Mouse + keyboard control
- Screen interaction

Allowed actions:
- "click"        → params: { "x": number, "y": number }
- "type"         → params: { "text": "string", "delay_ms": number (optional) }
- "keypress"     → params: { "key": "string", "modifiers": ["control","shift"] (optional), "delay_ms": number (optional) }
- "scroll"
- "screenshot"
- "get_active_window"
- "close_tab"
- "close_all_tabs"

IMPORTANT RULES:
- Desktop tool NEVER launches apps.
- Desktop tool ONLY interacts with already open applications.
- If a website is opened and then Enter must be pressed, ALWAYS add delay_ms (2000–5000 ms).
- Never press keys immediately after opening a URL without delay.

------------------------------------------------

3) "memory"
Purpose:
- Read or store structured memory

Allowed actions:
- "recall"
- "store"

------------------------------------------------

4) "n8n"
Purpose:
- Trigger automation workflows

Allowed actions:
- "execute_workflow"

------------------------------------------------

5) "web"
Purpose:
- Web scraping or search

Allowed actions:
- "search"
- "scrape"

==========================
PLAN FORMAT
==========================

{
  "goal": "short description",
  "steps": [
    {
      "tool": "tool_name",
      "action": "action_name",
      "params": {}
    }
  ],
  "risk": "low | medium | high"
}

If request is unclear:
Return:

{
  "goal": "unclear",
  "steps": [],
  "risk": "low"
}

==========================
MEMORY CONTEXT
==========================

${memoryContext}

==========================
USER REQUEST
==========================

${userInput}
`;
}

/* ================= JSON SAFETY ================= */

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return null;

  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    const jsonString = text.slice(start, end + 1);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/* ================= VALIDATION ================= */

function validatePlan(plan) {
  if (!plan || typeof plan !== "object") return false;
  if (typeof plan.goal !== "string") return false;
  if (!Array.isArray(plan.steps)) return false;
  if (!["low", "medium", "high"].includes(plan.risk)) return false;

  for (const step of plan.steps) {
    if (!step.tool || !step.action) return false;
    if (typeof step.params !== "object") return false;
  }

  return true;
}

/* ================= MEMORY FORMATTER ================= */

function formatMemoryBlock(memoryItems = []) {
  if (!memoryItems.length) return "None";

  return memoryItems
    .slice(0, MAX_MEMORY_ITEMS)
    .map((m, i) =>
      `[${i + 1}] (${m.type}) ${m.value}`
    )
    .join("\n");
}

/* ================= MAIN ================= */

async function generatePlan({ userInput }) {
  if (!userInput) return null;

  try {

    // 🔥 ALWAYS MEMORY AWARE
    const cognitive = await processMemoryQuery({
      text: userInput
    });

    const memoryItems =
      cognitive?.relevantMemory || [];

    const memoryContext =
      formatMemoryBlock(memoryItems);

    const prompt = buildPlannerPrompt(
      userInput,
      memoryContext
    );

    const raw = await runLLM({
      model: MODEL,
      prompt,
      timeout: TIMEOUT
    });

    console.log("\n=== RAW PLANNER OUTPUT ===");
    console.log(raw);
    console.log("===========================\n");

    const parsed = safeParseJSON(raw);

    if (!validatePlan(parsed)) {
      return null;
    }

    return parsed;

  } catch (err) {
    console.log("Planner Engine Error:", err?.message);
    return null;
  }
}

module.exports = {
  generatePlan
};