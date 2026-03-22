/**
 * Planner Engine — STRICT SCHEMA VERSION (Old-style reliable)
 *
 * Goal:
 * Planner outputs EXACT params expected by tools.
 * No flexible params.
 * Deterministic JSON.
 */

const { runLLM } = require("./llmRunner");
const { askGemini } = require("./geminiClient");
const { getActiveAI } = require("./aiSwitch");

const LOCAL_MODEL = "arvsal-planner";
const TIMEOUT = 120000;

/* ================= PROMPT ================= */

function buildPlannerPrompt(userInput, worldContext = {}) {

return `STRICT PLANNER ENGINE.
RETURN JSON ONLY.
NO TEXT.
NO MARKDOWN.
NO COMMENTS.

Your job:
Convert user request into TOOL ACTIONS using EXACT schemas.

You MUST follow examples exactly.

--------------------------------------------------
SYSTEM TOOL SCHEMA (IMPORTANT)

Open app:
{ "tool":"system","action":"open_app","params":{"name":"notepad"} }

Close app:
{ "tool":"system","action":"close_app","params":{"name":"notepad"} }

Open url:
{ "tool":"system","action":"open_url","params":{"url":"https://google.com"} }

--------------------------------------------------
DESKTOP TOOL SCHEMA (IMPORTANT)

Type text:
{ "tool":"desktop","action":"type","params":{"text":"hello"} }

Press key:
{ "tool":"desktop","action":"keypress","params":{"key":"enter"} }

Click element by description:
{ "tool":"desktop","action":"click","params":{"target":"send button"} }

Click with coordinates:
{ "tool":"desktop","action":"click","params":{"x":500,"y":400} }

Scroll:
{ "tool":"desktop","action":"scroll","params":{"x":0,"y":-300} }

Screenshot:
{ "tool":"desktop","action":"screenshot","params":{} }

--------------------------------------------------
RULES (VERY IMPORTANT)

1. NEVER invent new param names
2. NEVER mix actions (type + keypress together ❌)
3. Each step = ONE action
4. open_app MUST use params.name (NOT app)
5. type MUST use params.text
6. keypress MUST use params.key
7. scroll MUST use x,y (NOT direction words)
8. If user says "type and press enter" → TWO STEPS
9. Prefer desktop + system tools (skills optional)

--------------------------------------------------

WORLD CONTEXT:
${JSON.stringify(worldContext)}

USER REQUEST:
${userInput}

OUTPUT FORMAT:

{
 "goal":"short goal",
 "steps":[
   {"tool":"...","action":"...","params":{}}
 ],
 "risk":"low"
}
`;
}

/* ================= PARSER ================= */

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return null;

  try {
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch {}

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/* ================= VALIDATION ================= */

function validatePlan(plan) {
  if (!plan || typeof plan !== "object") return false;
  if (!Array.isArray(plan.steps)) return false;

  for (const s of plan.steps) {
    if (!s.tool || !s.action || typeof s.params !== "object") return false;
  }
  return true;
}

/* ================= MAIN ================= */

async function generatePlan({ userInput, worldContext }) {
  if (!userInput) return null;

  try {
    const prompt = buildPlannerPrompt(userInput, worldContext);

    const activeAI = getActiveAI();
    let raw = null;

    if (activeAI === "gemini") {
      try {
        raw = await askGemini(prompt);
      } catch {}
    }

    if (!raw) {
      raw = await runLLM({
        model: LOCAL_MODEL,
        prompt,
        timeout: TIMEOUT
      });
    }

    console.log("\n=== RAW PLANNER OUTPUT ===");
    console.log(raw);
    console.log("===========================\n");

    const parsed = safeParseJSON(raw);

    if (!validatePlan(parsed)) {
      console.log("[Planner] invalid plan:", parsed);
      return null;
    }

    return parsed;

  } catch (err) {
    console.log("[Planner] error:", err?.message);
    return null;
  }
}

module.exports = { generatePlan };























// /**
//  * Planner Engine — AI-Mode Aware (Gemini + Local)
//  *
//  * - Respects getActiveAI() — uses Gemini when connected, local otherwise
//  * - Always memory aware (cognitive engine)
//  * - Accepts screenContext + actionHints from orchestrator
//  * - Strict JSON output, validated
//  * - Production safe
//  */

// const { runLLM } = require("./llmRunner");
// const { askGemini } = require("./geminiClient");
// const { getActiveAI } = require("./aiSwitch");


// const LOCAL_MODEL = "arvsal-planner";
// const TIMEOUT = 120000;
// const MAX_MEMORY_ITEMS = 8;

// /* ================= PROMPT BUILDER ================= */

// function buildPlannerPrompt(userInput, worldContext) {
//   const lower = userInput.toLowerCase();

//   const needsWeb = /search|scrape|look up/i.test(lower);
//   const needsN8n = /workflow|automate|n8n/i.test(lower);
//   const needsDesktop = /click|type|keypress|scroll|screenshot|send|fill|press/i.test(lower);

//   let toolsList = `1) "system"\nActions: "open_app" {name}, "close_app" {name}, "open_url" {url}, "lock", "lock_after" {minutes}\n* Always use system for app launch.\n* Always use open_url for sites.\n`;

//   if (needsDesktop || (!needsWeb && !needsN8n)) {
//     toolsList += `2) "desktop" (UI control — never launches apps)\nActions:\n- "click" {target, x?, y?} → click a UI element. params.target = element description.\n- "type" {text, delay_ms?} → type text at cursor. params.text = exact text.\n- "keypress" {key, modifiers?} → press key. key = "enter","tab","escape","backspace","ctrl+c" etc.\n- "scroll" {direction, amount?} → scroll page. direction = "down","up","left","right". NO click needed.\n- "screenshot" → take screenshot.\n- "close_tab" → close current tab.\n- "close_all_tabs" → close all tabs.\nRULES:\n* Use "scroll" action for scroll up/down — NEVER click scrollbar.\n* Use "keypress" for enter/tab/escape — NEVER click buttons for these.\n* For "type": params.text = the text to type (required).\n* ALWAYS add delay_ms (2000-5000) between open_url and type.\n`;
//   }

//   toolsList += `3) "memory"\nActions: "recall", "store"\n`;
//   if (needsN8n) toolsList += `4) "n8n"\nActions: "execute_workflow"\n`;
//   if (needsWeb) toolsList += `5) "web"\nActions: "search", "scrape"\n`;
//   toolsList += `6) "skill" (high level abilities)
//   Actions:
//   - "send_message" {text}
//   - "scroll" {direction}
//   - "navigate" {target}
//   - "fill_form" {fields}
//   - "suggestion" {text}

//   RULE:
//   Prefer skill over raw desktop steps when possible.
//   `;

// return `STRICT PLANNER ENGINE. JSON ONLY. NO EXPLANATION.

// Convert the user request into a structured JSON action plan.
// If the request is conversational/unclear → return {"goal":"unclear","steps":[],"risk":"low"}

// [TOOLS]
// ${toolsList}

// [WORLD CONTEXT]
// ${JSON.stringify(worldContext, null, 2)}

// [USER REQUEST]
// ${userInput}

// [OUTPUT FORMAT — return ONLY this JSON]
// {
//   "goal": "one line description",
//   "steps": [{"tool":"name", "action":"action_name", "params":{}}],
//   "risk": "low"
// }`;
// }

// /* ================= JSON PARSER ================= */

// function safeParseJSON(text) {
//   if (!text || typeof text !== "string") return null;

//   try {
//     // remove markdown fences
//     text = text.replace(/```json/g, "").replace(/```/g, "").trim();

//     // try direct parse
//     return JSON.parse(text);
//   } catch {}

//   try {
//     // extract first json object
//     const match = text.match(/\{[\s\S]*\}/);
//     if (!match) return null;

//     const candidate = match[0]
//       .replace(/\\'/g, "'")     // fix escaped single quotes
//       .replace(/\n/g, " ");

//     return JSON.parse(candidate);
//   } catch {
//     return null;
//   }
// }

// /* ================= VALIDATION ================= */

// function validatePlan(plan) {
//   if (!plan || typeof plan !== "object") return false;
//   if (typeof plan.goal !== "string") return false;
//   if (!Array.isArray(plan.steps)) return false;
//   if (!["low", "medium", "high"].includes(plan.risk)) return false;
//   for (const step of plan.steps) {
//     if (!step.tool || !step.action) return false;
//     if (typeof step.params !== "object") return false;
//   }
//   return true;
// }

// /* ================= MEMORY FORMATTER ================= */

// function formatMemoryBlock(items = []) {
//   if (!items.length) return "None";
//   return items
//     .slice(0, MAX_MEMORY_ITEMS)
//     .map((m, i) => `[${i + 1}] (${m.type}) ${m.value}`)
//     .join("\n");
// }

// /* ================= MAIN ================= */

// async function generatePlan({ userInput, worldContext }) {
//   if (!userInput) return null;

//   try {

//     const prompt = buildPlannerPrompt(userInput, worldContext || {});

//     const activeAI = getActiveAI();
//     let raw = null;

//     /* ===== GEMINI (when connected) ===== */
//     if (activeAI === "gemini") {
//       console.log("[Planner] Using Gemini for plan generation");
//       try {
//         raw = await askGemini(prompt);
//       } catch (err) {
//         console.log("[Planner] Gemini failed, falling back to local:", err?.message);
//       }
//     }

//     /* ===== LOCAL (default + fallback) ===== */
//     if (!raw) {
//       console.log(`[Planner] Using local model: ${LOCAL_MODEL}`);
//       raw = await runLLM({ model: LOCAL_MODEL, prompt, timeout: TIMEOUT });
//     }

//     console.log("\n=== RAW PLANNER OUTPUT ===");
//     console.log(raw);
//     console.log("===========================\n");

//     const parsed = safeParseJSON(raw);

//     if (!validatePlan(parsed)) {
//       console.log("[Planner] Validation failed — plan was:", parsed);
//       return null;
//     }

//     return parsed;

//   } catch (err) {
//     console.log("[Planner] Error:", err?.message);
//     return null;
//   }
// }

// module.exports = { generatePlan };