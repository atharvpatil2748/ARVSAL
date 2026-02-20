const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { Porcupine } = require("@picovoice/porcupine-node");
const { PvRecorder } = require("@picovoice/pvrecorder-node");

// 1. Ghost Mode Configuration
const isGhost = process.env.GHOST_MODE === 'true';

// Performance switches for background stability
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("enable-media-stream");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let mainWindow = null;
let backendProcess = null;
let porcupine = null;
let recorder = null;
let wakeListening = false;

/* ================= BACKEND ================= */

function startBackend() {
  if (backendProcess) return;

  const backendPath = path.join(__dirname, "..", "backend", "server.js");

  backendProcess = spawn("node", [backendPath], {
    stdio: "inherit",
    windowsHide: true
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

/* ================= WINDOW ================= */

async function createWindow() {
  // Only create window if we are NOT in ghost mode
  if (isGhost) {
    console.log("👻 ARVSAL GHOST MODE: Backend and Wake Listener active. UI suppressed.");
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
    path.join(__dirname, "renderer", "index.html")
  );
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
    headers: { "Content-Type": "audio/wav" },
    body: Buffer.from(wavBuffer)
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

ipcMain.on("arvsal:resumeWake", async () => {
  console.log("🔁 Resume wake requested");
  await startWakeListener();
});

ipcMain.on("arvsal:stopWake", async () => {
  console.log("⛔ Stop wake requested");
  await stopWakeListener();
});

/* ================= WAKE WORD ================= */

function initWake() {
  if (porcupine && recorder) return;

  const accessKey = "iQtVjOBqQIUK5GawII0gcaQAgk+9iO4FEU6K3OY4593HljkEPxffNA=="; 

  porcupine = new Porcupine(
    accessKey,
    [path.join(__dirname, "arv-sal_en_windows_v4_0_0.ppn")],
    [0.8]
  );

  recorder = new PvRecorder(porcupine.frameLength, -1);
}

async function startWakeListener() {
  initWake();

  if (wakeListening) {
    console.log("⚠️ Wake already running");
    return;
  }

  try {
    await recorder.start();
    wakeListening = true;
    console.log("🎤 Wake word listening...");
    listenLoop();
  } catch (err) {
    console.log("❌ Wake start error:", err);
  }
}

async function stopWakeListener() {
  if (!wakeListening) return;
  wakeListening = false;

  try {
    await recorder.stop();
    console.log("🛑 Wake listener stopped.");
  } catch (err) {
    console.log("Stop error:", err);
  }
}

async function listenLoop() {
  console.log("👂 Wake loop started");
  while (wakeListening) {
    let frame;
    try {
      frame = await recorder.read();
    } catch (err) {
      if (!wakeListening) return;
      console.log("Wake read error:", err);
      return;
    }

    if (!wakeListening) return;
    const result = porcupine.process(frame);

    if (result >= 0) {
      console.log("🔥 Wake word detected!");
      await stopWakeListener();

      // Check if window exists before trying to send event
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("arvsal:wake");
      } else if (isGhost) {
        // Trigger background-specific logic here if needed
        console.log("Wake detected in Ghost Mode. Processing background task...");
      }
      return;
    }
  }
}

/* ================= INIT ================= */

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(permission === "media");
    }
  );

  startBackend();
  await createWindow();
  startWakeListener();
});

app.on("window-all-closed", () => {
  // Only quit if we aren't in Ghost Mode
  if (!isGhost) {
    if (backendProcess) backendProcess.kill();
    if (process.platform !== "darwin") app.quit();
  }
});












// const { app, BrowserWindow, ipcMain, session } = require("electron");
// app.commandLine.appendSwitch("disable-renderer-backgrounding");
// app.commandLine.appendSwitch("disable-background-timer-throttling");

// const path = require("path");
// const { spawn } = require("child_process");
// const { Porcupine } = require("@picovoice/porcupine-node");
// const { PvRecorder } = require("@picovoice/pvrecorder-node");

// const fetch = (...args) =>
//   import("node-fetch").then(({ default: fetch }) => fetch(...args));

// let mainWindow = null;
// let backendProcess = null;

// let porcupine = null;
// let recorder = null;
// let wakeListening = false;

// /* ================= BACKEND ================= */

// function startBackend() {
//   if (backendProcess) return;

//   const backendPath = path.join(__dirname, "..", "backend", "server.js");

//   backendProcess = spawn("node", [backendPath], {
//     stdio: "inherit",
//     windowsHide: true
//   });

//   backendProcess.on("exit", () => {
//     backendProcess = null;
//   });
// }

// /* ================= WINDOW ================= */

// async function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1000,
//     height: 700,
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//       contextIsolation: true,
//       nodeIntegration: false,
//       sandbox: false,
//       backgroundThrottling: false
//     }
//   });

//   await mainWindow.loadFile(
//     path.join(__dirname, "renderer", "index.html")
//   );
// }

// /* ================= IPC ================= */

// ipcMain.handle("arvsal:command", async (_e, command) => {
//   const res = await fetch("http://localhost:3000/command", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ command })
//   });
//   return res.json();
// });

// ipcMain.handle("arvsal:audio", async (_e, wavBuffer) => {
//   const res = await fetch("http://localhost:3000/audio", {
//     method: "POST",
//     headers: { "Content-Type": "audio/wav" },
//     body: Buffer.from(wavBuffer)
//   });
//   return res.json();
// });

// ipcMain.handle("arvsal:speak", async (_e, text) => {
//   const res = await fetch("http://localhost:3000/speak", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text })
//   });
//   return Buffer.from(await res.arrayBuffer());
// });

// ipcMain.on("arvsal:resumeWake", async () => {
//   console.log("🔁 Resume wake requested");
//   await startWakeListener();
// });

// ipcMain.on("arvsal:stopWake", async () => {
//   console.log("⛔ Stop wake requested");
//   await stopWakeListener();
// });

// /* ================= WAKE WORD ================= */

// function initWake() {
//   if (porcupine && recorder) return;

//   const accessKey = "iQtVjOBqQIUK5GawII0gcaQAgk+9iO4FEU6K3OY4593HljkEPxffNA=="; // "Bg1SYDuF5hFe2wCvzHQRjn55EoTk0BqdKhS1IO40aHvXjp9Hafq0BA=="; //  KEY for Hey Arv-Asal, but we use a custom model now so not needed

//   porcupine = new Porcupine(
//     accessKey,
//     [path.join(__dirname, "arv-sal_en_windows_v4_0_0.ppn")],
//     [0.8]
//   );

//   recorder = new PvRecorder(porcupine.frameLength, -1);
// }

// async function startWakeListener() {

//   initWake();

//   if (wakeListening) {
//     console.log("⚠️ Wake already running");
//     return;
//   }

//   try {
//     await recorder.start();
//     wakeListening = true;
//     console.log("🎤 Wake word listening...");
//     listenLoop();
//   } catch (err) {
//     console.log("❌ Wake start error:", err);
//   }
// }

// async function stopWakeListener() {

//   if (!wakeListening) return;

//   wakeListening = false;

//   try {
//     await recorder.stop();
//     console.log("🛑 Wake listener stopped.");
//   } catch (err) {
//     console.log("Stop error:", err);
//   }
// }

// async function listenLoop() {

//   console.log("👂 Wake loop started");

//   while (wakeListening) {

//     let frame;

//     try {
//       frame = await recorder.read();
//     } catch (err) {

//       if (!wakeListening) {
//         console.log("Wake read stopped intentionally.");
//         return;
//       }

//       console.log("Wake read error:", err);
//       return;
//     }

//     if (!wakeListening) return;

//     const result = porcupine.process(frame);

//     if (result >= 0) {

//       console.log("🔥 Wake word detected!");

//       await stopWakeListener();

//       if (mainWindow && !mainWindow.isDestroyed()) {
//         mainWindow.webContents.send("arvsal:wake");
//       }

//       return;
//     }
//   }

//   console.log("⚠️ Wake loop exited");
// }


// /* ================= INIT ================= */

// app.commandLine.appendSwitch("enable-media-stream");

// app.whenReady().then(async () => {
//   session.defaultSession.setPermissionRequestHandler(
//     (_wc, permission, callback) => {
//       callback(permission === "media");
//     }
//   );

//   startBackend();
//   await createWindow();
//   startWakeListener();
// });

// app.on("window-all-closed", () => {
//   if (backendProcess) backendProcess.kill();
//   if (process.platform !== "darwin") app.quit();
// });






