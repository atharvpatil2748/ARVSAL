/**
 * Unified Agent Loop — Phase 0.5
 *
 * Implements the ReAct (Reason + Act) cognitive loop.
 *
 * Flow:
 *   Build Context → Call Model → Parse Response →
 *   Tool Call? → Execute → Append Result → Reason Again → Final Response
 *
 * Model routing:
 *   All model configuration lives in config/unifiedCoreConfig.js.
 *   NO model name is hardcoded in this file.
 *   NO hidden fallback chains.
 *
 * Safety:
 *   - Hard iteration cap (MAX_ITERATIONS from config)
 *   - Tool failure is non-fatal: appended as context for LLM self-correction
 *   - Parser errors allow MAX_CONSECUTIVE_ERRORS retries
 *   - All tool calls go through the existing executeTool registry
 */

'use strict';

const { buildContext } = require('@core/cognitive/unifiedContextBuilder');
const { parse } = require('@core/reasoning/responseParser');
const { executeTool } = require('@tools/toolRegistry');
const { runLLM } = require('@providers/llm/llmRunner');
const { getActiveAI } = require('@providers/llm/aiSwitch');
const { askGemini } = require('@providers/external/geminiClient');
const applyPersonality = require('@core/personality/personality');

// SINGLE SOURCE OF TRUTH — all model/behavior config lives here
const {
  PRIMARY_MODEL,
  MAX_ITERATIONS,
  MAX_CONSECUTIVE_ERRORS,
  LLM_TIMEOUT_MS,
  ALLOW_RAW_TEXT_FALLBACK
} = require('@config/unifiedCoreConfig');

/* ================= LLM RUNNER ================= */

/**
 * Executes a single LLM turn using the active AI provider.
 *
 * Priority:
 *   1. Gemini (when ACTIVE_AI === 'gemini' via aiSwitch)
 *   2. gemma4:e4b via Ollama (PRIMARY_MODEL from config)
 *   3. NO silent local fallback — if PRIMARY_MODEL fails, returns null
 *      and the loop handles it as an explicit error.
 *
 * @param {string} prompt - Full assembled prompt string
 * @returns {Promise<string|null>}
 */
async function callModel(prompt) {
  const activeAI = getActiveAI();

  // External Gemini path (user has explicitly switched to cloud AI)
  if (activeAI === 'gemini') {
    try {
      const out = await askGemini(prompt);
      if (out && out.trim()) {
        console.log('[UnifiedAgentLoop] Used Gemini for reasoning.');
        return out.trim();
      }
    } catch (err) {
      console.warn('[UnifiedAgentLoop] Gemini call failed:', err.message);
      // Fall through to local model — do NOT silently die
    }
  }

  // Local primary model (gemma4:e4b per config)
  console.log(`[UnifiedAgentLoop] Calling local model: ${PRIMARY_MODEL}`);
  const raw = await runLLM({
    model: PRIMARY_MODEL,
    prompt,
    timeout: LLM_TIMEOUT_MS,
    isStructured: true
  });

  if (!raw) {
    console.error(`[UnifiedAgentLoop] Primary model '${PRIMARY_MODEL}' returned null. Is it running in Ollama?`);
  }

  return raw || null;
}

/* ================= PROMPT ASSEMBLY ================= */

/**
 * Assembles a single-string prompt from system context + conversation history.
 * Uses Ollama /api/generate format (single string, not messages array).
 *
 * The format is tuned for gemma4:e4b instruction-following characteristics.
 * If migrating to /api/chat endpoint, replace this with a messages[] builder.
 */
function assemblePrompt(systemPrompt, messages) {
  const historyText = messages
    .map(m => {
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `ARVSAL: ${m.content}`;
      return `System: ${m.content}`;
    })
    .join('\n');

  return `${systemPrompt}\n\n--- CONVERSATION ---\n${historyText}\n\nARVSAL (respond with a single JSON object only, no prose):`;
}

/* ================= MAIN AGENT LOOP ================= */

/**
 * Runs the Unified Cognitive Agent Loop for a given user query.
 *
 * @param {string} userQuery - The raw user input (already stripped of /u prefix)
 * @param {string} [intentType] - Optional intent hint from intentClassifier
 * @returns {Promise<string>} Final conversational response string
 */
async function runAgent(userQuery, intentType = 'GENERAL') {
  if (!userQuery || typeof userQuery !== 'string') {
    return "I didn't catch that, sir.";
  }

  // 1. Build unified context (UCML memory + persona + tools + world state)
  let systemPrompt;
  let memoryBlock;
  let memorySources;
  try {
    ({ systemPrompt, memoryBlock, memorySources } = await buildContext(userQuery, intentType));
  } catch (err) {
    console.error('[UnifiedAgentLoop] Context build failed:', err.message);
    return "I'm having trouble organizing my thoughts right now, sir. Please try again.";
  }

  // 2. Initialize conversation history for this agent session
  const messages = [
    { role: 'user', content: userQuery }
  ];

  let iteration = 0;
  let consecutiveErrors = 0;
  let lastRaw = null;

  console.log(`[UnifiedAgentLoop] START — model=${PRIMARY_MODEL} memoryOk=${!!(memoryBlock && memoryBlock.length > 0)} query="${userQuery.substring(0, 80)}"`);

  // 3. ReAct Loop
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[UnifiedAgentLoop] Iteration ${iteration}/${MAX_ITERATIONS}`);

    const prompt = assemblePrompt(systemPrompt, messages);

    let raw = null;
    try {
      raw = await callModel(prompt);
    } catch (err) {
      console.error('[UnifiedAgentLoop] Model call threw exception:', err.message);
    }

    if (!raw) {
      messages.push({
        role: 'system',
        content: 'ERROR: The LLM returned no output. Please respond with a valid JSON object following the response contract.'
      });
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
      continue;
    }

    lastRaw = raw;
    console.log(`[UnifiedAgentLoop] Raw output (first 300 chars): ${raw.substring(0, 300)}`);

    // 4. Parse response against Structured Response Contract
    const parsed = parse(raw);

    // --- HANDLE CONTRACT VIOLATION (parser error) ---
    if (parsed.type === 'error') {
      console.warn('[UnifiedAgentLoop] Contract violation:', parsed.message);
      messages.push({
        role: 'system',
        content: [
          `CONTRACT VIOLATION: ${parsed.message}`,
          'You MUST respond with ONLY a single JSON object.',
          'No prose. No markdown. No explanation.',
          'Valid types: tool_call, final_response, request_context, delegate',
          'Example: {"type":"final_response","response":"Hello sir."}'
        ].join(' ')
      });
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        if (ALLOW_RAW_TEXT_FALLBACK) {
          console.warn('[UnifiedAgentLoop] Falling back to raw text after max contract violations.');
          const cleaned = raw.replace(/```json?|```/g, '').trim();
          return await applyPersonality(cleaned) || "I'm not sure how to respond to that, sir.";
        }
        break;
      }
      continue;
    }

    consecutiveErrors = 0;

    // --- FINAL RESPONSE ---
    if (parsed.type === 'final_response') {
      console.log('[UnifiedAgentLoop] Final response produced.');
      return await applyPersonality(parsed.response);
    }

    // --- REQUEST CONTEXT ---
    if (parsed.type === 'request_context') {
      console.log('[UnifiedAgentLoop] Model requested context — returning question to user.');
      return await applyPersonality(parsed.question);
    }

    // --- DELEGATE (Phase 2 placeholder) ---
    if (parsed.type === 'delegate') {
      console.log(`[UnifiedAgentLoop] Delegation requested to: ${parsed.target} (not yet implemented)`);
      messages.push({
        role: 'system',
        content: `DELEGATION NOTE: Model '${parsed.target}' is not yet available. Please complete the task '${parsed.task}' using your current capabilities and respond with a final_response or tool_call.`
      });
      continue;
    }

    // --- TOOL CALL ---
    if (parsed.type === 'tool_call') {
      const { tool, action, params = {} } = parsed;
      console.log(`[UnifiedAgentLoop] Tool call: ${tool}.${action} params=${JSON.stringify(params)}`);

      let toolResult;
      try {
        toolResult = await executeTool({ tool, action, params });
      } catch (err) {
        toolResult = { success: false, error: `Tool execution threw: ${err.message}` };
      }

      const resultText = toolResult.success
        ? `TOOL_RESULT [${tool}.${action}]: ${JSON.stringify(toolResult)}`
        : `TOOL_ERROR [${tool}.${action}]: ${toolResult.error || 'Unknown error'}. Inform the user gracefully or try an alternative approach.`;

      console.log(`[UnifiedAgentLoop] Tool result: ${resultText.substring(0, 200)}`);

      messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
      messages.push({ role: 'system',    content: resultText });
      continue;
    }
  }

  // Max iterations exhausted
  console.warn(`[UnifiedAgentLoop] Max iterations (${MAX_ITERATIONS}) reached without final_response.`);
  return await applyPersonality(
    "I've reached my reasoning limit without a clear answer. Could you rephrase that, sir?"
  );
}

module.exports = { runAgent };
