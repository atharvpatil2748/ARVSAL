/**
 * riskEngine.js
 *
 * Production Risk Evaluation Layer
 *
 * - Deterministic
 * - Tool-aware
 * - Action-aware
 * - Threshold-based
 * - Fully loggable
 */

const fs = require("fs");
const path = require("path");

/* ================= CONFIG ================= */

const LOG_PATH = path.join(__dirname, "../logs/risk.log");

const RISK_LEVELS = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

/*
  Thresholds:
  0 → execute silently
  1 → log only
  2 → require confirmation
  3 → block
*/

const CONFIRMATION_THRESHOLD = RISK_LEVELS.HIGH;
const BLOCK_THRESHOLD = RISK_LEVELS.CRITICAL;

/* ================= TOOL RISK MAP ================= */

const TOOL_BASE_RISK = {
  memory: RISK_LEVELS.LOW,
  system: RISK_LEVELS.MEDIUM,
  desktop: RISK_LEVELS.MEDIUM,
  n8n: RISK_LEVELS.MEDIUM,
  web: RISK_LEVELS.MEDIUM
};

/* ================= ACTION RISK OVERRIDES ================= */

const ACTION_RISK_RULES = [
  {
    match: (tool, action) =>
      tool === "system" && action === "shutdown",
    level: RISK_LEVELS.CRITICAL
  },
  {
    match: (tool, action) =>
      tool === "system" && action === "restart",
    level: RISK_LEVELS.CRITICAL
  },
  {
    match: (tool, action) =>
      tool === "system" && action === "delete_file",
    level: RISK_LEVELS.HIGH
  },
  {
    match: (tool, action) =>
      tool === "desktop" && action === "send_message",
    level: RISK_LEVELS.HIGH
  },
  {
    match: (tool, action) =>
      tool === "desktop" && action === "click",
    level: RISK_LEVELS.MEDIUM
  },
  {
    match: (tool, action) =>
      tool === "n8n" && action === "execute_workflow",
    level: RISK_LEVELS.MEDIUM
  },
  {
    match: (tool, action) =>
      tool === "system" && action === "lock",
    level: RISK_LEVELS.MEDIUM
  },
  {
    match: (tool, action) =>
      tool === "system" && action === "lock_after",
    level: RISK_LEVELS.MEDIUM
  }
];

/* ================= UTIL ================= */

function logRisk(entry) {
  try {
    const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {
    console.error("RISK LOG ERROR:", err.message);
  }
}

/* ================= EVALUATION ================= */

function evaluate(plan = {}) {
  if (!plan || !Array.isArray(plan.steps)) {
    return {
      allowed: false,
      reason: "Invalid plan structure",
      level: RISK_LEVELS.CRITICAL
    };
  }

  let highestRisk = RISK_LEVELS.LOW;

  for (const step of plan.steps) {
    const tool = step.tool;
    const action = step.action;

    if (!tool || !action) continue;

    let stepRisk = TOOL_BASE_RISK[tool] ?? RISK_LEVELS.MEDIUM;

    for (const rule of ACTION_RISK_RULES) {
      if (rule.match(tool, action)) {
        stepRisk = rule.level;
        break;
      }
    }

    if (stepRisk > highestRisk) {
      highestRisk = stepRisk;
    }
  }

  const result = {
    level: highestRisk,
    allowed: highestRisk < BLOCK_THRESHOLD,
    requiresConfirmation: highestRisk >= CONFIRMATION_THRESHOLD,
    timestamp: Date.now()
  };

  logRisk({
    plan,
    riskLevel: highestRisk,
    requiresConfirmation: result.requiresConfirmation
  });

  return result;
}

module.exports = {
  evaluate,
  RISK_LEVELS
};