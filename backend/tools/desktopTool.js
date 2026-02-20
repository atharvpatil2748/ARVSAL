/**
 * Desktop Tool – Real Execution Version (RobotJS Integrated)
 *
 * PURPOSE:
 * - Mouse + keyboard automation
 * - Deterministic execution
 * - No reasoning
 * - Safe validation
 */

const robot = require("robotjs");
const fs = require("fs");
const path = require("path");

/* ================= CONFIG ================= */

const LOG_FILE = path.join(__dirname, "../logs/toolExecution.log");

/* ================= SAFE ACTION WHITELIST ================= */

const ALLOWED_ACTIONS = [
  "click",
  "type",
  "keypress",
  "scroll",
  "screenshot",
  "get_active_window",
  "close_tab",
  "close_all_tabs"
];

/* ================= LOGGER ================= */

function logExecution(entry) {
  try {
    const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // logging must never crash system
  }
}

/* ================= EXECUTE ================= */

async function execute(actionObject) {

  const { action, params = {} } = actionObject;

  if (!ALLOWED_ACTIONS.includes(action)) {
    return {
      success: false,
      error: `Action not allowed: ${action}`
    };
  }

  try {

    /* ===== TYPE ===== */
    if (action === "type") {

      const content = params.text || params.value;

      if (!content) {
        return { success: false, error: "Type requires value" };
      }

      robot.typeString(content);

      logExecution({ tool: "desktop", action, content });

      return {
        success: true,
        message: "Typed successfully"
      };
    }

    /* ===== KEYPRESS ===== */
    if (action === "keypress") {

      if (!params.key) {
        return { success: false, error: "Keypress requires key" };
      }

      const delay = Number(params.delay_ms) || 0;

      // 🔁 Optional delay before keypress
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const key = params.key.toLowerCase();

      try {

        if (params.modifiers) {
          robot.keyTap(key, params.modifiers);
        } else {
          robot.keyTap(key);
        }

        logExecution({
          tool: "desktop",
          action,
          key,
          delay_ms: delay
        });

        return {
          success: true,
          message: `Key '${key}' pressed after ${delay}ms delay`
        };

      } catch (err) {
        return {
          success: false,
          error: "Keypress execution failed"
        };
      }
    }

    /* ===== CLICK ===== */
    if (action === "click") {

      const { x, y, button = "left" } = params;

      if (typeof x !== "number" || typeof y !== "number") {
        return { success: false, error: "Click requires x and y coordinates" };
      }

      robot.moveMouseSmooth(x, y);
      robot.mouseClick(button);

      logExecution({ tool: "desktop", action, x, y, button });

      return {
        success: true,
        message: "Mouse clicked"
      };
    }

    /* ===== SCROLL ===== */
    if (action === "scroll") {

      const { x = 0, y = 0 } = params;

      robot.scrollMouse(x, y);

      logExecution({ tool: "desktop", action, x, y });

      return {
        success: true,
        message: "Scrolled"
      };
    }

    /* ===== CLOSE TAB ===== */
    if (action === "close_tab") {

      robot.keyTap("w", "control");

      return {
        success: true,
        message: "Closed current tab"
      };
    }

    /* ===== CLOSE ALL TABS ===== */
    if (action === "close_all_tabs") {

      robot.keyTap("w", ["control", "shift"]);

      return {
        success: true,
        message: "Closed all tabs"
      };
    }

    /* ===== SCREENSHOT ===== */
    if (action === "screenshot") {

      const img = robot.screen.capture();
      const filePath = path.join(__dirname, "../logs/screenshot.png");

      fs.writeFileSync(filePath, img.image);

      return {
        success: true,
        message: "Screenshot captured"
      };
    }

    /* ===== GET ACTIVE WINDOW (Stub for now) ===== */
    if (action === "get_active_window") {

      return {
        success: true,
        message: "Active window detection not implemented yet"
      };
    }

    return {
      success: false,
      error: "Unknown desktop action"
    };

  } catch (err) {

    return {
      success: false,
      error: err.message || "Desktop tool execution failed"
    };
  }
}

/* ================= EXPORT ================= */

module.exports = {
  execute
};
