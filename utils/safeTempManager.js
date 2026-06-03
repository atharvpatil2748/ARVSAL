// backend/utils/safeTempManager.js

const fs = require("fs");
const path = require("path");
const pathConfig = require("./pathConfig");

const TEMP_ROOT = pathConfig.TEMP_DIR;

const ACTIVE_FILES = new Set();

/**
 * Create unique temp file path
 */
function createTempFile(name = "arvsal", ext = ".png") {
  let subdir = "misc";

  if (name.includes("tts")) {
    subdir = "tts";
  } else if (
    name.includes("audio") ||
    name.includes("final")
  ) {
    subdir = "audio";
  } else if (name.includes("vad")) {
    subdir = "vad";
  } else if (
    name.includes("stt") ||
    name.includes("whisper")
  ) {
    subdir = "stt";
  }

  const dir = path.join(TEMP_ROOT, subdir);

  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(
    dir,
    `${name}_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`
  );

  ACTIVE_FILES.add(file);

  return file;
}

/**
 * Safe delete with retries (async, non-blocking)
 */
function safeDelete(file, retries = 6, delay = 800) {
  if (!file) return;

  const attempt = (n) => {
    setTimeout(() => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        ACTIVE_FILES.delete(file);
      } catch (err) {
        if (n > 0) {
          attempt(n - 1);
        }
      }
    }, delay);
  };

  attempt(retries);
}

/**
 * Cleanup all active temp files (on shutdown)
 */
function cleanupAll() {
  for (const f of ACTIVE_FILES) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  }
  ACTIVE_FILES.clear();
}

module.exports = {
  createTempFile,
  safeDelete,
  cleanupAll
};