const { app, BrowserWindow, ipcMain, session } = require("electron");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

const path = require("path");
const { spawn } = require("child_process");
const { Porcupine } = require("@picovoice/porcupine-node");
const { PvRecorder } = require("@picovoice/pvrecorder-node");

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

  const accessKey = "Bg1SYDuF5hFe2wCvzHQRjn55EoTk0BqdKhS1IO40aHvXjp9Hafq0BA==";

  porcupine = new Porcupine(
    accessKey,
    [path.join(__dirname, "hey-arv-asal_en_windows_v4_0_0.ppn")],
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

      if (!wakeListening) {
        console.log("Wake read stopped intentionally.");
        return;
      }

      console.log("Wake read error:", err);
      return;
    }

    if (!wakeListening) return;

    const result = porcupine.process(frame);

    if (result >= 0) {

      console.log("🔥 Wake word detected!");

      await stopWakeListener();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("arvsal:wake");
      }

      return;
    }
  }

  console.log("⚠️ Wake loop exited");
}


/* ================= INIT ================= */

app.commandLine.appendSwitch("enable-media-stream");

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
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});









// const { app, BrowserWindow, ipcMain, session } = require("electron");
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
//       sandbox: false
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

// /* ================= WAKE WORD ================= */

// function startWakeListener() {
//   if (wakeListening) return;

//   const accessKey = "Bg1SYDuF5hFe2wCvzHQRjn55EoTk0BqdKhS1IO40aHvXjp9Hafq0BA==";

//   porcupine = new Porcupine(
//     accessKey,
//     [path.join(__dirname, "hey-arv-asal_en_windows_v4_0_0.ppn")],
//     [0.6]
//   );

//   recorder = new PvRecorder(porcupine.frameLength, -1);

//   recorder.start();
//   wakeListening = true;

//   console.log("🎤 Wake word listening...");

//   listenLoop();
// }

// async function listenLoop() {
//   while (wakeListening) {
//     try {
//       const frame = await recorder.read();
//       const result = porcupine.process(frame);

//       if (result >= 0) {
//         console.log("🔥 Wake word detected!");

//         wakeListening = false;
//         await recorder.stop();

//         if (mainWindow && !mainWindow.isDestroyed()) {
//           mainWindow.webContents.send("arvsal:wake");
//         }
//       }
//     } catch {
//       break;
//     }
//   }
// }

// ipcMain.on("arvsal:resumeWake", () => {
//   console.log("🔁 Resuming wake listener...");
//   startWakeListener();
// });

// /* ================= PERMISSIONS ================= */

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







