/**
 * Memory Tool
 *
 * PURPOSE:
 * - Execute structured memory actions
 * - No reasoning
 * - No LLM
 * - Deterministic only
 */

const memory = require("../memory"); // semantic
const episodicMemory = require("../episodicMemory");
const reflectionMemory = require("../reflectionMemory");

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

/* ================= EXPORT ================= */

module.exports = {
  execute
};