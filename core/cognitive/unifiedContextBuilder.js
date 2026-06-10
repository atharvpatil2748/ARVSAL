/**
 * Unified Context Builder — Phase 0.5 (Memory Integration Fix)
 *
 * Fuses:
 *   - Personality + Response Contract
 *   - Memory via cognitiveStateManager.getContextBlock()  ← UCML / RAMIndexer pipeline
 *   - Tool Schemas (Capability abstraction layer)
 *   - World State Placeholder (Phase 1 slot)
 *   - Capability Exposure Placeholder (Phase 2 slot)
 *
 * CRITICAL FIX (Phase 0.5B):
 *   Original implementation incorrectly called cognitiveEngine.processMemoryQuery()
 *   which is the legacy O(N) embedding engine. This bypassed the entire UCML
 *   subsystem (RAMIndexer: 2752 entities, 58 dates, 275 vectors, 34 CSG nodes).
 *
 *   Corrected to call cognitiveStateManager.getContextBlock() — the same
 *   production memory pipeline used by the legacy llmRouter path.
 *
 * Memory pipeline (correct path):
 *   buildContext()
 *     → cognitiveStateManager.getContextBlock()
 *       → workingMemory (L1 ephemeral)
 *       → cognitiveStateGraph.search() (L2 fast hybrid)
 *       → ArchiveOrchestrator.queryUnifiedMemory() (UCML scatter-gather)
 *         → RAMIndexer (entity/date/vector/decision/CSG indexes)
 *         → UnifiedRanker
 *         → MemoryFusionEngine.fuse()
 */

'use strict';

const { getContextBlock } = require('@core/cognitive/cognitiveStateManager');
const semanticMemory = require('@core/memory/semanticMemory');

/* ================= TOOL SCHEMA (Capability Abstraction Layer) ================= */

/**
 * Capability Placeholder.
 * Phase 2: Replace body with CapabilityRouter.resolveCapabilities(intentType).
 */
function fetchCapabilities(intentType) {
  const schemas = [
    {
      tool: "system",
      description: "Control operating-system-level actions on the host machine.",
      actions: {
        open_app:  { params: { name: "string" }, example: '{"tool":"system","action":"open_app","params":{"name":"notepad"}}' },
        close_app: { params: { name: "string" }, example: '{"tool":"system","action":"close_app","params":{"name":"notepad"}}' },
        open_url:  { params: { url: "string" },  example: '{"tool":"system","action":"open_url","params":{"url":"https://google.com"}}' }
      }
    },
    {
      tool: "desktop",
      description: "Control the graphical desktop: clicking, typing, scrolling, screenshots.",
      actions: {
        click:      { params: { target: "string (element description) OR x+y (numbers)" } },
        type:       { params: { text: "string" } },
        keypress:   { params: { key: "string (e.g. enter, tab, escape, ctrl+c)" } },
        scroll:     { params: { x: "number", y: "number" } },
        screenshot: { params: {} }
      }
    },
    {
      tool: "memory",
      description: "Read from or write to ARVSAL's persistent memory store.",
      actions: {
        recall: { params: { subject: "string", key: "string" } },
        store:  { params: { subject: "string", key: "string", value: "string" } }
      }
    }
  ];

  return JSON.stringify(schemas, null, 2);
}

/* ================= WORLD STATE SLOT (Phase 1 Placeholder) ================= */

function fetchWorldState() {
  // PHASE 1: Replace with ProjectionBuilder.project()
  return JSON.stringify({
    _note: "World State Engine not yet active. Phase 1 pending.",
    goals: [],
    relationships: [],
    projects: [],
    activeContext: null
  }, null, 2);
}

/* ================= PERSONA BLOCK ================= */

function buildPersonaBlock() {
  return [
    "You are ARVSAL, an advanced personal AI assistant.",
    "You communicate in a direct, intelligent, and professional manner.",
    "When the user needs an action executed, respond with a structured JSON tool call.",
    "When you have the answer, respond with a structured JSON final_response.",
    "The MEMORY_CONTEXT block contains verified facts, relationships, and past events about the user.",
    "You MUST use memory when answering identity questions ('Who am I?', 'What do you know about me?').",
    "You NEVER output raw prose in place of the structured response contract.",
    "Address the user as 'Sir' occasionally, in a Jarvis-like manner."
  ].join("\n");
}

/* ================= RESPONSE CONTRACT ================= */

function buildContractInstructions() {
  return `
RESPONSE CONTRACT (MANDATORY):
Always respond with a single valid JSON object. No prose before or after it.

1. Execute an action:
{"type":"tool_call","tool":"system","action":"open_app","params":{"name":"notepad"}}

2. Give a final answer (use this for conversational replies and memory queries):
{"type":"final_response","response":"<your complete answer here>"}

3. Ask for missing information:
{"type":"request_context","question":"<what you need to know>"}

CRITICAL RULES:
- Do NOT output any text outside the JSON object.
- When memory context is provided, use it to answer identity questions directly.
- Use final_response for all conversational replies, memory questions, and knowledge answers.
- Only use request_context when critical information is genuinely missing.
`.trim();
}

/* ================= MAIN CONTEXT BUILDER ================= */

/**
 * Builds the full Unified Context for the Agent Loop.
 *
 * Uses cognitiveStateManager.getContextBlock() — the production UCML pipeline.
 *
 * @param {string} userQuery - The raw user query
 * @param {string} [intentType] - Optional intent classification hint
 * @param {object} [intentObj] - Full deterministic intent object
 * @returns {Promise<{systemPrompt: string, memoryBlock: string}>}
 */
async function buildContext(userQuery, intentType = 'GENERAL', intentObj = null) {

  // ── MEMORY RETRIEVAL (corrected path: UCML pipeline) ──────────────────────
  let memoryBlock = '';
  let memorySources = { ucml: false, directUserFacts: false, error: null };

  try {
    // isLocalModel: true → enables full memory injection (privacy gate in CSM)
    memoryBlock = await getContextBlock({ text: userQuery, isLocalModel: true }) || '';
    memorySources.ucml = memoryBlock.length > 0;
  } catch (err) {
    memorySources.error = err.message;
    console.warn('[UnifiedContextBuilder] Memory retrieval failed:', err.message);
  }

  // ── SELF-REFERENTIAL QUERY PRE-RESOLUTION (Phase 0.5B Fix) ────────────────
  const SELF_PRONOUNS = /\b(i|me|my|mine|myself|am i)\b/i;
  if (SELF_PRONOUNS.test(userQuery)) {
    const userFacts = semanticMemory.summarize('user');
    if (userFacts && userFacts.length > 0) {
      memorySources.directUserFacts = true;
      let userBlock = `[VERIFIED FACTS ABOUT YOU (THE USER)]\n`;
      for (const fact of userFacts) {
        userBlock += `- your ${fact.key} is ${fact.value}\n`;
      }
      userBlock += `\n`;
      
      if (memoryBlock.includes('=== COGNITIVE STATE ===')) {
        memoryBlock = memoryBlock.replace('=== COGNITIVE STATE ===\n', `=== COGNITIVE STATE ===\n${userBlock}`);
      } else {
        memoryBlock = `=== COGNITIVE STATE ===\n${userBlock}=======================\n\n` + memoryBlock;
      }
    }
  }

  // ── MEMORY TRACE LOG ──────────────────────────────────────────────────────
  if (process.env.UCML_DEBUG === 'true') {
    console.log(`\n=================================================`);
    console.log(`[MEMORY TRACE] UnifiedContextBuilder`);
    console.log(`Query: "${userQuery}"`);
    console.log(`UCML pipeline called: ${memorySources.ucml}`);
    console.log(`Direct user facts injected: ${memorySources.directUserFacts}`);
    console.log(`Memory block length: ${memoryBlock.length} chars`);
    if (memorySources.error) {
      console.log(`Error: ${memorySources.error}`);
    }
    console.log(`\nMemory block injected into prompt:`);
    console.log(`--- MEMORY_CONTEXT START ---`);
    console.log(memoryBlock || '(empty)');
    console.log(`--- MEMORY_CONTEXT END ---`);
    console.log(`=================================================\n`);
  }

  const memoryPresent = memoryBlock && memoryBlock.trim().length > 0;
  const memorySection = memoryPresent
    ? memoryBlock.trim()
    : 'No relevant memory found for this query.';

  // ── PROMPT ASSEMBLY ───────────────────────────────────────────────────────
  const toolSchemas = fetchCapabilities(intentType);
  const worldState  = fetchWorldState();
  const persona     = buildPersonaBlock();
  const contract    = buildContractInstructions();

  const systemPrompt = `<SYSTEM_PERSONA>
${persona}

${contract}
</SYSTEM_PERSONA>

<WORLD_STATE_PROJECTION>
${worldState}
</WORLD_STATE_PROJECTION>

<INTENT_METADATA>
${intentObj ? JSON.stringify(intentObj, null, 2) : '{"intent": "' + intentType + '"}'}
</INTENT_METADATA>

<AVAILABLE_TOOLS>
${toolSchemas}
</AVAILABLE_TOOLS>

<MEMORY_CONTEXT hasMemory="${memoryPresent}">
${memorySection}
</MEMORY_CONTEXT>`;

  return { systemPrompt, memoryBlock, memorySources };
}

module.exports = {
  buildContext,
  fetchCapabilities,
  fetchWorldState
};
