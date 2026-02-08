/**
 * Embedding Model (OLLAMA CLI – ACTUALLY WORKING)
 *
 * - Ollama v0.15.x compatible
 * - Windows safe
 * - No JSON assumptions
 * - Deterministic + fail-safe
 */

const { spawn } = require("child_process");

const OLLAMA_PATH =
  "C:\\Users\\athar\\AppData\\Local\\Programs\\Ollama\\ollama.exe";

/**
 * Extract numeric vector from Ollama stdout
 */
function extractVector(text) {
  if (!text || typeof text !== "string") return null;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) && arr.every(n => typeof n === "number")
      ? arr
      : null;
  } catch {
    return null;
  }
}

function embedText(text, timeoutMs = 5000) {
  return new Promise(resolve => {
    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return resolve(null);
    }

    let output = "";
    let finished = false;

    let proc;
    try {
      proc = spawn(
        OLLAMA_PATH,
        ["run", "nomic-embed-text"],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
      );
    } catch {
      return resolve(null);
    }

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { proc.kill("SIGKILL"); } catch {}
      resolve(null);
    }, timeoutMs);

    proc.stdout.on("data", chunk => {
      if (!finished) output += chunk.toString();
    });

    proc.stderr.on("data", () => {}); // swallow spinner

    proc.on("error", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(null);
    });

    proc.on("close", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(extractVector(output));
    });

    try {
      proc.stdin.write(text);
      proc.stdin.end();
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

module.exports = { embedText };