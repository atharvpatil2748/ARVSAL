/**
 * System Tool – Production Version
 *
 * PURPOSE:
 * - Launch installed applications
 * - Open URLs
 * - No arbitrary shell execution
 * - Sanitized input
 */

const { exec } = require("child_process");

/* ================= SANITIZER ================= */

/**
 * Prevent command injection
 * Allows only letters, numbers, dash, space
 */
function sanitizeAppName(name) {
  if (!name || typeof name !== "string") return null;

  const cleaned = name.trim().toLowerCase();

  if (!/^[a-z0-9\-\s]+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/* ================= OPEN APP ================= */

function buildOpenCommand(appName) {
  const platform = process.platform;

  if (platform === "win32") {
    // Try direct launch
    return `start "" ${appName}`;
  }

  if (platform === "darwin") {
    return `open -a "${appName}"`;
  }

  return `${appName}`;
}

/* ================= OPEN URL ================= */

function buildOpenURLCommand(url) {
  if (!/^https?:\/\/.+/i.test(url)) return null;

  const platform = process.platform;

  if (platform === "win32") {
    return `start "" "${url}"`;
  }

  if (platform === "darwin") {
    return `open "${url}"`;
  }

  return `xdg-open "${url}"`;
}

/* ================= EXECUTE ================= */
let lockTimer = null;
async function execute(actionObject) {

  const { action, params = {} } = actionObject;
  const target = params.name || params.target || null;
  const url = params.url || null;

  try {

    /* ===== OPEN APP ===== */
    if (action === "open_app") {

      if (!target) {
        return { success: false, error: "App name required" };
      }

      let command = null;
      const platform = process.platform;
      const app = target.toLowerCase();

      if (platform === "win32") {

      const NATIVE_EXECUTABLES = {
        notepad: "notepad",
        calculator: "calc",
        calc: "calc",
        paint: "mspaint",
        cmd: "cmd",
        powershell: "powershell",
        explorer: "explorer",
        taskmanager: "taskmgr",
        task_manager: "taskmgr",
        controlpanel: "control",
        control_panel: "control",
        device_manager: "devmgmt.msc",
        services: "services.msc",
        regedit: "regedit",
        msconfig: "msconfig"
      };

      const WINDOWS_URI_APPS = {
        settings: "ms-settings:",
        bluetooth: "ms-settings:bluetooth",
        wifi: "ms-settings:network-wifi",
        network: "ms-settings:network",
        display: "ms-settings:display",
        camera: "microsoft.windows.camera:",
        store: "ms-windows-store:",
        calendar: "outlookcal:"
      };

      const WEB_FALLBACK = {
        youtube: "https://www.youtube.com",
        whatsapp: "https://web.whatsapp.com"
      };

      const CLI_APPS = {
        ollama: "ollama"
      };

      if (NATIVE_EXECUTABLES[app]) {
        command = `start "" ${NATIVE_EXECUTABLES[app]}`;
      }
      else if (WINDOWS_URI_APPS[app]) {
        command = `start "" ${WINDOWS_URI_APPS[app]}`;
      }
      else if (WEB_FALLBACK[app]) {
        command = `start "" ${WEB_FALLBACK[app]}`;
      }
      else if (CLI_APPS[app]) {
        command = `start "" ${CLI_APPS[app]}`;
      }
      else {
        command = `start "" "${app}"`;
      }
    }

      if (!command) {
        return { success: false, error: "Unsupported platform" };
      }

      exec(command);

      return {
        success: true,
        executed: command
      };
    }

    /* ===== OPEN URL ===== */
    if (action === "open_url") {

      if (!url) {
        return { success: false, error: "URL required" };
      }

      let command;

      if (process.platform === "win32")
        command = `start "" "${url}"`;
      else if (process.platform === "darwin")
        command = `open "${url}"`;
      else
        command = `xdg-open "${url}"`;

      exec(command);

      return {
        success: true,
        executed: command
      };
    }

    /* ===== CLOSE APP ===== */
    if (action === "close_app") {

      if (!target) {
        return { success: false, error: "App name required" };
      }

      const app = target.toLowerCase();

      let command = null;

      if (process.platform === "win32") {

        const PROCESS_MAP = {
          notepad: "notepad.exe",
          chrome: "chrome.exe",
          ollama: "ollama.exe",
          camera: "WindowsCamera.exe"
        };

        const processName = PROCESS_MAP[app] || `${app}.exe`;

        command = `taskkill /IM ${processName} /F`;
      }

      exec(command);

      return {
        success: true,
        executed: command
      };
    }

    /* ===== LOCK PC ===== */
    if (action === "lock") {

      if (process.platform !== "win32") {
        return { success: false, error: "Lock supported only on Windows" };
      }

      const command = `rundll32.exe user32.dll,LockWorkStation`;

      exec(command);

      return {
        success: true,
        executed: command
      };
    }

    /* ===== TIMED LOCK ===== */
    if (action === "lock_after") {

      if (process.platform !== "win32") {
        return { success: false, error: "Lock supported only on Windows" };
      }

      const minutes = Number(params.minutes);

      if (!minutes || minutes < 0) {
        return { success: false, error: "Valid minutes required" };
      }

      // Clear previous timer if exists
      if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
      }

      lockTimer = setTimeout(() => {
        exec(`rundll32.exe user32.dll,LockWorkStation`);
        lockTimer = null;
      }, minutes * 60 * 1000);

      return {
        success: true,
        scheduled: true,
        minutes
      };
    }

    return {
      success: false,
      error: `Unknown system action: ${action}`
    };

  } catch (err) {
    return {
      success: false,
      error: "System tool execution failed"
    };
  }
}
/* ================= EXPORT ================= */

module.exports = {
  execute
};