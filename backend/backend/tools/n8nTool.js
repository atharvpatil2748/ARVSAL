/**
 * n8n Tool
 *
 * PURPOSE:
 * - Sends structured automation requests to n8n webhook
 * - Returns structured result
 * - Logs execution
 *
 * This tool NEVER reasons.
 * It only forwards automation requests.
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

/* ================= CONFIG ================= */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || null;
const TIMEOUT_MS = 15000;

const LOG_FILE = path.join(__dirname, "../logs/toolExecution.log");

/* ================= LOGGER ================= */

function logExecution(entry) {
  try {
    const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    // logging must never crash system
  }
}

/* ================= TIMEOUT WRAPPER ================= */

function fetchWithTimeout(url, options, timeout) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("n8n timeout")), timeout)
    )
  ]);
}

/* ================= EXECUTE ================= */

async function execute(actionObject) {

  if (!N8N_WEBHOOK_URL) {
    return {
      success: false,
      error: "N8N_WEBHOOK_URL not configured"
    };
  }

  try {

    logExecution({
      tool: "n8n",
      actionObject
    });

    const response = await fetchWithTimeout(
      N8N_WEBHOOK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(actionObject)
      },
      TIMEOUT_MS
    );

    if (!response.ok) {
      return {
        success: false,
        error: `n8n responded with status ${response.status}`
      };
    }

    const data = await response.json().catch(() => ({}));

    return {
      success: true,
      result: data
    };

  } catch (err) {

    logExecution({
      tool: "n8n",
      error: err.message
    });

    return {
      success: false,
      error: err.message
    };
  }
}

/* ================= EXPORT ================= */

module.exports = {
  execute
};