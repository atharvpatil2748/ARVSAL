/**
 * Tool Registry
 *
 * Central execution router for all tools.
 *
 * RULES:
 * - Registry NEVER reasons
 * - Registry NEVER modifies action
 * - Registry ONLY routes + logs
 * - Tool execution is isolated
 */

const fs = require("fs");
const path = require("path");

/* ================= LOAD TOOLS ================= */

const memoryTool = require("./memoryTool");
const systemTool = require("./systemTool");
const desktopTool = require("./desktopTool");
const n8nTool = require("./n8nTool");

/* ================= CONFIG ================= */

const LOG_FILE = path.join(__dirname, "../toolExecution.log");

/* ================= SAFE LOG ================= */

function logExecution(entry) {
  try {
    const line = JSON.stringify({
      ...entry,
      timestamp: Date.now()
    }) + "\n";

    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // absolute fail-safe
  }
}

/* ================= TOOL MAP ================= */

const TOOL_MAP = {
  memory: memoryTool,
  system: systemTool,
  desktop: desktopTool,
  n8n: n8nTool
};

/* ================= VALIDATION ================= */

function isValidAction(action) {
  return (
    action &&
    typeof action === "object" &&
    typeof action.tool === "string" &&
    typeof action.action === "string"
  );
}

/* ================= MAIN EXECUTOR ================= */

/**
 * Execute structured tool action
 * @param {object} actionObject
 * @returns {object}
 */
async function executeTool(actionObject) {

  if (!isValidAction(actionObject)) {
    return {
      success: false,
      error: "Invalid action structure"
    };
  }

  const toolName = actionObject.tool.toLowerCase();

  const tool = TOOL_MAP[toolName];

  if (!tool || typeof tool.execute !== "function") {
    return {
      success: false,
      error: `Tool not found: ${toolName}`
    };
  }

  try {

    const result = await tool.execute(actionObject);

    logExecution({
      tool: toolName,
      action: actionObject.action,
      success: result?.success ?? false
    });

    return result || { success: true };

  } catch (err) {

    logExecution({
      tool: toolName,
      action: actionObject.action,
      success: false,
      error: err?.message
    });

    return {
      success: false,
      error: "Tool execution failed"
    };
  }
}

/* ================= EXPORT ================= */

module.exports = {
  executeTool
};