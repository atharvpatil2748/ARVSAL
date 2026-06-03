/**
 * Memory Tool
 *
 * PURPOSE:
 * - Execute structured memory actions
 * - No reasoning
 * - No LLM
 * - Deterministic only
 */

const memory = require('@core/memory/semanticMemory'); // semantic
const episodicMemory = require('@core/memory/episodicMemory');
const reflectionMemory = require('@core/memory/reflectionMemory');
const memoryTools = require('@core/cognitive/memoryTools');
const decisionRegistry = require('@core/cognitive/decisionRegistry');

/* ================= VALIDATION ================= */

function isString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/* ================= EXECUTE ================= */

async function execute(actionObject) {

  const { action, subject, key, value, limit } = actionObject;

  const targetSubject = subject || "user";

  try {

    /* ===== RECALL SEMANTIC ===== */
    if (action === "recall_semantic") {

      const facts = memory.summarize(targetSubject) || [];

      if (!facts.length) {
        return { success: true, data: [] };
      }

      return {
        success: true,
        data: facts
      };
    }

    /* ===== GET SPECIFIC FACT ===== */
    if (action === "get_fact") {

      if (!isString(key)) {
        return { success: false, error: "Key required" };
      }

      const facts = memory.summarize(targetSubject) || [];

      const found = facts.find(f =>
        f.key.toLowerCase() === key.toLowerCase()
      );

      return {
        success: true,
        data: found || null
      };
    }

    /* ===== STORE SEMANTIC FACT ===== */
    if (action === "store_fact") {

      if (!isString(key) || !isString(value)) {
        return { success: false, error: "Key and value required" };
      }

      memory.remember(targetSubject, key, value);

      return { success: true };
    }

    /* ===== RECALL EPISODIC ===== */
    if (action === "recall_episodic") {

      const events =
        episodicMemory.getBySubject(targetSubject, limit || 10) || [];

      return {
        success: true,
        data: events
      };
    }

    /* ===== RECALL BY DATE RANGE ===== */
    if (action === "recall_by_date") {

      if (!actionObject.start || !actionObject.end) {
        return { success: false, error: "Date range required" };
      }

      const events = episodicMemory.getByDateRange(
        actionObject.start,
        actionObject.end
      );

      return {
        success: true,
        data: events || []
      };
    }

    /* ===== RECALL REFLECTION ===== */
    if (action === "recall_reflection") {

      const reflections =
        reflectionMemory.getBySubject(targetSubject) || [];

      return {
        success: true,
        data: reflections
      };
    }

    /* ===== COGNITIVE STATE GRAPH (CSG) TOOLS ===== */

    if (action === "upsert_cognitive_node") {
      if (!isString(actionObject.type) || !isString(actionObject.label)) {
        return { success: false, error: "type and label required" };
      }
      const node = await memoryTools.upsertMemoryNode({
        type: actionObject.type,
        label: actionObject.label,
        summary: actionObject.summary,
        pinned: actionObject.pinned,
        parentId: actionObject.parentId
      });
      return { success: true, data: node };
    }

    if (action === "query_cognitive_graph") {
      if (!isString(actionObject.query)) return { success: false, error: "query required" };
      const hits = await memoryTools.queryMemoryGraph({ query: actionObject.query });
      return { success: true, data: hits };
    }

    if (action === "resolve_cognitive_node") {
      if (!isString(actionObject.nodeId)) return { success: false, error: "nodeId required" };
      const success = await memoryTools.resolveMemoryNode({ nodeId: actionObject.nodeId });
      return { success };
    }

    if (action === "pin_cognitive_node") {
      if (!isString(actionObject.nodeId)) return { success: false, error: "nodeId required" };
      const success = await memoryTools.pinToWorkingMemory({ nodeId: actionObject.nodeId });
      return { success };
    }

    /* ===== DECISION REGISTRY TOOLS ===== */

    if (action === "record_decision") {
      if (!isString(actionObject.label) || !isString(actionObject.rationale)) {
        return { success: false, error: "label and rationale required" };
      }
      const node = await decisionRegistry.recordDecision({
        label: actionObject.label,
        rationale: actionObject.rationale,
        alternatives: actionObject.alternatives || [],
        parentId: actionObject.parentId
      });
      return { success: true, data: node };
    }

    if (action === "lookup_decision") {
      if (!isString(actionObject.query)) return { success: false, error: "query required" };
      const hits = await decisionRegistry.lookupDecision(actionObject.query);
      return { success: true, data: hits };
    }

    /* ===== UNKNOWN ACTION ===== */
    return {
      success: false,
      error: `Unknown memory action: ${action}`
    };

  } catch (err) {

    return {
      success: false,
      error: "Memory tool execution failed"
    };
  }
}

const _execute = execute;

module.exports = {
  execute: async function(actionObject) {
    const out = await _execute(actionObject);
    console.log(`\n==================================================\nMEMORY TOOL AUDIT\n=================\nTool: ${actionObject.action}\nInput: ${JSON.stringify(actionObject)}\nOutput: ${JSON.stringify(out)}\n==================================================\n`);
    return out;
  }
};