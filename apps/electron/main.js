require("module-alias/register");
const { app, BrowserWindow, ipcMain, session, globalShortcut } = require("electron");
const path   = require("path");
const { spawn } = require("child_process");
const WakeWordEngine = require("@modules/wake/wakeWord");
// ── Ghost Mode ────────────────────────────────────────────────────────────────
const isGhost = process.env.GHOST_MODE === 'true';

// Performance switches for background stability
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("enable-media-stream");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let mainWindow    = null;
let backendProcess = null;
let wakeEngine    = null;   // AVAListener Python bridge

/* ================= BACKEND ================= */

function startBackend() {
  if (backendProcess) return;
  const backendPath = path.join(__dirname, "..", "..", "backend", "server.js");
  backendProcess = spawn("node", [backendPath], {
    stdio: "inherit",
    windowsHide: true
  });
  backendProcess.on("exit", () => { backendProcess = null; });
}

/* ================= WINDOW ================= */

async function createWindow() {
  if (isGhost) {
    console.log("👻 ARVSAL GHOST MODE: Backend and Wake Engine active. UI suppressed.");
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  await mainWindow.loadFile(
    path.join(__dirname, "../renderer/index.html")
  );
}

/* ================= WAKE ENGINE ================= */

function startWakeEngine() {
  if (wakeEngine) return;

  wakeEngine = new WakeWordEngine();

  wakeEngine.on('ready', () => {
    console.log("🎤 AVAListener ready — wake detection active");
  });

  wakeEngine.on('wake', (e) => {
    console.log(`🔥 Wake detected: phrase="${e.phrase}" raw=${e.raw_confidence?.toFixed(2)} smooth=${e.smooth_confidence?.toFixed(2)}`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Forward wake event to renderer (IPC contract preserved)
      mainWindow.webContents.send("arvsal:wake");
    } else if (isGhost) {
      // Ghost Mode: no renderer window — log and optionally trigger backend action
      console.log("👻 Ghost Mode wake — no UI to notify.");
    }
  });

  wakeEngine.on('heartbeat', (e) => {
    // Uncomment for verbose uptime monitoring:
    // console.log(`[wakeEngine] heartbeat uptime=${e.uptime_s}s`);
  });

  wakeEngine.on('error', (err) => {
    console.error("[wakeEngine] recoverable error:", err.message);
  });

  wakeEngine.on('fatal', (err) => {
    console.error("[wakeEngine] FATAL — max restarts exceeded:", err.message);
    // Future: surface alert to renderer / admin UI
  });

  wakeEngine.on('exit', ({ code, signal }) => {
    console.log(`[wakeEngine] process exited code=${code} signal=${signal}`);
  });

  wakeEngine.start();
}

/* ================= IPC ================= */

ipcMain.handle("arvsal:command", async (_e, command) => {
  const res = await fetch("http://localhost:3000/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command })
  });
  return res.json();
});

ipcMain.handle("arvsal:audio", async (_e, wavBuffer) => {
  const res = await fetch("http://localhost:3000/audio", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: Buffer.from(wavBuffer)
  });
  return res.json();
});

ipcMain.handle("arvsal:finalAudio", async (_e, buffer) => {
  const res = await fetch("http://localhost:3000/audio/final", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: Buffer.from(buffer)
  });
  return res.json();
});

ipcMain.handle("arvsal:speak", async (_e, text) => {
  const res = await fetch("http://localhost:3000/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return Buffer.from(await res.arrayBuffer());
});

ipcMain.handle("arvsal:streamAudio", async (_e, buffer) => {
  console.log("IPC stream hit, bytes:", buffer.byteLength);
  const res = await fetch("http://localhost:3000/audio/stream", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: Buffer.from(buffer)
  });
  return res.json();
});

/**
 * arvsal:resumeWake
 * Renderer calls this after it finishes recording user audio.
 * Resumes wake detection without restarting or warming up the pipeline.
 */
ipcMain.on("arvsal:resumeWake", () => {
  console.log("🔁 Resume wake requested");
  if (wakeEngine) wakeEngine.resume();
});

/**
 * arvsal:stopWake
 * Renderer calls this when it is about to start recording user audio.
 * Pauses wake detection (pipeline stays fully warm — instant resume).
 */
ipcMain.on("arvsal:stopWake", () => {
  console.log("⛔ Stop wake requested");
  if (wakeEngine) wakeEngine.pause();
});

/**
 * arvsal:ttsStart / arvsal:ttsEnd
 * Backend notifies Electron when TTS playback starts/ends.
 * Suppress wake during speaker output to prevent self-wake.
 */
ipcMain.on("arvsal:ttsStart", () => {
  if (wakeEngine) wakeEngine.suppress();
});

ipcMain.on("arvsal:ttsEnd", () => {
  if (wakeEngine) wakeEngine.resume();
});

/* ================= INIT ================= */

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(permission === "media");
    }
  );

  startBackend();
  await createWindow();
  startWakeEngine();

  // ── Global hotkey: Ctrl+Shift+A ──────────────────────────────────────────
  const hotkeySuccess = globalShortcut.register("CommandOrControl+Shift+A", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("arvsal:hotkey");
    }
  });
  console.log("[HOTKEY] Ctrl+Shift+A registered:", hotkeySuccess);
});

app.on("before-quit", async () => {
  globalShortcut.unregisterAll();

  // Deterministic shutdown: pause detection → stop engine → kill process
  if (wakeEngine) {
    wakeEngine.pause();
    wakeEngine.stop();
    wakeEngine = null;
  }

  if (backendProcess) backendProcess.kill();
});

app.on("window-all-closed", () => {
  if (!isGhost) {
    if (process.platform !== "darwin") app.quit();
  }
});
