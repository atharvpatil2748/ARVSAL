/**
 * System Actions
 *
 * Deterministic, guarded OS-level actions.
 * NO memory. NO context. NO reasoning.
 * Executes commands ONCE and safely.
 */

const { exec } = require("child_process");
const fs = require("fs");

/* ================= CONFIG ================= */

const EXEC_TIMEOUT_MS = 8000;
const NIRCMD = "C:\\Windows\\System32\\nircmd.exe";
const HAS_NIRCMD = fs.existsSync(NIRCMD);

/* ================= EXECUTION LOCK ================= */

// Prevent repeated destructive execution
const executionLock = new Set();

function lockOnce(key, fn) {
  if (executionLock.has(key)) {
    console.warn("SYSTEM ACTION BLOCKED (already executed):", key);
    return;
  }
  executionLock.add(key);
  fn();
}

/* ================= SAFE EXEC ================= */

function run(cmd) {
  if (typeof cmd !== "string") return;
  const clean = cmd.trim();
  if (!clean) return;

  exec(
    clean,
    { windowsHide: true, timeout: EXEC_TIMEOUT_MS },
    (err) => {
      if (err) {
        console.error("SYSTEM CMD ERROR:", err.message);
      }
    }
  );
}

/* ================= SANITIZERS ================= */

function safeString(input) {
  if (typeof input !== "string") return "";
  return input.replace(/[\r\n"]/g, "").trim();
}

/* ================= WEB ================= */

function openURL(url) {
  if (typeof url !== "string") return;
  if (!/^https?:\/\//i.test(url)) return;
  run(`cmd /c start "" "${safeString(url)}"`);
}

function searchGoogle(query = "") {
  openURL(
    `https://www.google.com/search?q=${encodeURIComponent(String(query))}`
  );
}

function openYouTube(query = "") {
  openURL(
    query
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
          String(query)
        )}`
      : "https://www.youtube.com"
  );
}

/* ================= APPS ================= */

function openApp(app) {
  if (typeof app !== "string") return;

  switch (app.toLowerCase()) {
    case "chrome":
      run("cmd /c start chrome");
      break;
    case "edge":
      run("cmd /c start msedge");
      break;
    case "notepad":
      run("notepad");
      break;
    case "calculator":
      run("calc");
      break;
    case "settings":
      run("cmd /c start ms-settings:");
      break;
    case "whatsapp":
      run("cmd /c start whatsapp:");
      break;
    default:
      console.warn("Unknown app:", app);
  }
}

/* ================= FOLDERS ================= */

function openFolder(folderPath) {
  const cleanPath = safeString(folderPath);
  if (!cleanPath) return;
  run(`cmd /c start "" "${cleanPath}"`);
}

/* ================= CALENDAR ================= */

function openCalendar() {
  run("cmd /c start outlookcal:");
  setTimeout(() => {
    openURL("https://outlook.live.com/calendar/");
  }, 300);
}

/* ================= SYSTEM (DESTRUCTIVE) ================= */

function shutdown() {
  lockOnce("shutdown", () => {
    run("shutdown /s /t 5");
  });
}

function restart() {
  lockOnce("restart", () => {
    run("shutdown /r /t 5");
  });
}

function sleep() {
  lockOnce("sleep", () => {
    run("rundll32.exe powrprof.dll,SetSuspendState 0,0,0");
  });
}

function lock() {
  run("rundll32.exe user32.dll,LockWorkStation");
}

/* ================= VOLUME ================= */

function volumeUp() {
  if (!HAS_NIRCMD) {
    console.warn("Volume control unavailable (nircmd missing)");
    return;
  }
  run(`"${NIRCMD}" changesysvolume 5000`);
}

function volumeDown() {
  if (!HAS_NIRCMD) {
    console.warn("Volume control unavailable (nircmd missing)");
    return;
  }
  run(`"${NIRCMD}" changesysvolume -5000`);
}

function mute() {
  if (!HAS_NIRCMD) {
    console.warn("Mute unavailable (nircmd missing)");
    return;
  }
  run(`"${NIRCMD}" mutesysvolume 2`);
}

/* ================= MEDIA ================= */

function playPause() {
  if (!HAS_NIRCMD) return;
  run(`"${NIRCMD}" sendkey media_play_pause press`);
}

function nextTrack() {
  if (!HAS_NIRCMD) return;
  run(`"${NIRCMD}" sendkey media_next press`);
}

function prevTrack() {
  if (!HAS_NIRCMD) return;
  run(`"${NIRCMD}" sendkey media_prev press`);
}

/* ================= EXPORTS ================= */

module.exports = {
  openApp,
  openFolder,
  searchGoogle,
  openYouTube,
  openCalendar,
  shutdown,
  restart,
  sleep,
  lock,
  volumeUp,
  volumeDown,
  mute,
  playPause,
  nextTrack,
  prevTrack
};










// /**
//  * System Actions
//  *
//  * Deterministic, guarded OS-level actions.
//  * NO memory. NO context. NO reasoning.
//  * This file ONLY executes commands.
//  */

// const { exec } = require("child_process");
// const fs = require("fs");

// // ================= CONFIG =================

// // Optional dependency (do NOT assume existence)
// const NIRCMD = "C:\\Windows\\System32\\nircmd.exe";
// const HAS_NIRCMD = fs.existsSync(NIRCMD);

// // ================= SAFE EXEC =================

// function run(cmd) {
//   if (typeof cmd !== "string" || !cmd.trim()) return;

//   exec(cmd, { windowsHide: true }, (err) => {
//     if (err) {
//       console.error("SYSTEM CMD ERROR:", err.message);
//     }
//   });
// }

// // ================= WEB =================

// function openURL(url) {
//   if (!/^https?:\/\//i.test(url)) return;
//   run(`cmd /c start "" "${url}"`);
// }

// function searchGoogle(query = "") {
//   openURL(
//     `https://www.google.com/search?q=${encodeURIComponent(String(query))}`
//   );
// }

// function openYouTube(query = "") {
//   if (!query) {
//     openURL("https://www.youtube.com");
//   } else {
//     openURL(
//       `https://www.youtube.com/results?search_query=${encodeURIComponent(
//         String(query)
//       )}`
//     );
//   }
// }

// // ================= APPS =================

// function openApp(app) {
//   if (typeof app !== "string") return;

//   switch (app.toLowerCase()) {
//     case "chrome":
//       run("cmd /c start chrome");
//       break;

//     case "edge":
//       run("cmd /c start msedge");
//       break;

//     case "notepad":
//       run("notepad");
//       break;

//     case "calculator":
//       run("calc");
//       break;

//     case "settings":
//       run("cmd /c start ms-settings:");
//       break;

//     default:
//       console.warn("Unknown app:", app);
//   }
// }

// // ================= FOLDERS =================

// function openFolder(path) {
//   if (typeof path !== "string" || !path.trim()) return;
//   run(`cmd /c start "" "${path}"`);
// }

// // ================= CALENDAR =================

// function openCalendar() {
//   run("cmd /c start outlookcal:");
// }

// // ================= SYSTEM =================

// function shutdown() {
//   run("shutdown /s /t 5");
// }

// function restart() {
//   run("shutdown /r /t 5");
// }

// function sleep() {
//   run("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
// }

// function lock() {
//   run("rundll32.exe user32.dll,LockWorkStation");
// }

// // ================= VOLUME =================

// function volumeUp() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" changesysvolume 5000`);
// }

// function volumeDown() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" changesysvolume -5000`);
// }

// function mute() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" mutesysvolume 2`);
// }

// // ================= MEDIA =================

// function playPause() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" sendkey media_play_pause press`);
// }

// function nextTrack() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" sendkey media_next press`);
// }

// function prevTrack() {
//   if (!HAS_NIRCMD) return;
//   run(`"${NIRCMD}" sendkey media_prev press`);
// }

// // ================= EXPORTS =================

// module.exports = {
//   openApp,
//   openFolder,
//   searchGoogle,
//   openYouTube,
//   openCalendar,
//   shutdown,
//   restart,
//   sleep,
//   lock,
//   volumeUp,
//   volumeDown,
//   mute,
//   playPause,
//   nextTrack,
//   prevTrack
// };






