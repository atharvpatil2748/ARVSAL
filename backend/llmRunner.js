/**
 * LLM Runner — ACTUALLY BULLETPROOF (Ollama Correct)
 *
 * - Uses STDIN correctly (REQUIRED by Ollama)
 * - Closes stdin (prevents hangs)
 * - Serialized (Windows safe)
 * - Ignores spinner junk
 * - Safe continuation for truncated output
 * - No crashes, no fake timeouts
 */

const { spawn } = require("child_process");

/* ================= CONFIG ================= */

const HARD_TIMEOUT = 100000;
const MAX_OUTPUT_SIZE = 1000 * 1024;

const LLM_DEBUG = process.env.LLM_DEBUG === "true";
const debug = (...a) => LLM_DEBUG && console.log("[LLM_DEBUG]", ...a);

/* ================= INCOMPLETE OUTPUT CHECK ================= */

function isIncomplete(text) {
  if (!text || typeof text !== "string") return true;

  const t = text.trim();

  // Ends abruptly
  if (/[,:;(\[]$/.test(t)) return true;

  // Hanging logical connectors
  if (/\b(if|because|when|which|that|so)\s*$/i.test(t)) return true;

  // No sentence termination
  if (!/[.!?]$/.test(t)) return true;

  // Unbalanced parentheses
  const openParens = (t.match(/\(/g) || []).length;
  const closeParens = (t.match(/\)/g) || []).length;

  return openParens !== closeParens;
}

/* ================= SERIAL QUEUE ================= */

let BUSY = false;
const QUEUE = [];

function runLLM(params) {
  return new Promise(resolve => {
    QUEUE.push({ params, resolve });
    pump();
  });
}

async function pump() {
  if (BUSY || QUEUE.length === 0) return;

  BUSY = true;
  const { params, resolve } = QUEUE.shift();

  try {
    const result = await runInternal(params);
    resolve(result);
  } catch {
    resolve(null);
  } finally {
    BUSY = false;
    pump();
  }
}

/* ================= CORE EXECUTION ================= */

function runInternal({ model, prompt, timeout = HARD_TIMEOUT }) {
  return new Promise(resolve => {
    let output = "";
    let finished = false;
    let didContinue = false;

    let proc;
    try {
      proc = spawn("ollama", ["run", model], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (err) {
      debug("SPAWN FAILED:", err?.message);
      return resolve(null);
    }

    if (!proc?.stdin || !proc?.stdout || !proc?.stderr) {
      debug("INVALID PROCESS");
      return resolve(null);
    }

    debug("Spawn Ollama:", model);

    /* 🔑 WRITE PROMPT + CLOSE STDIN (CRITICAL) */
    try {
      proc.stdin.write(prompt);
      proc.stdin.end();
    } catch {
      return resolve(null);
    }

    const killTimer = setTimeout(() => {
      if (finished) return;
      finished = true;

      debug("LLM HARD TIMEOUT:", model);
      try { proc.kill("SIGKILL"); } catch {}

      let result = output.trim();

      // 🔁 ONE safe continuation attempt
      if (!didContinue && result && isIncomplete(result)) {
        didContinue = true;
        debug("INCOMPLETE OUTPUT, CONTINUATION ATTEMPT");

        runLLM({
          model,
          prompt: result + "\nContinue.",
          timeout: Math.min(timeout, 30000)
        }).then(continuation => {
          if (typeof continuation === "string" && continuation.trim()) {
            result = (result + " " + continuation).trim();
          }
          resolve(result || null);
        });

        return;
      }

      resolve(result || null);
    }, timeout);

    proc.stdout.on("data", chunk => {
      if (finished) return;

      output += chunk.toString();

      if (output.length > MAX_OUTPUT_SIZE) {
        finished = true;
        clearTimeout(killTimer);
        debug("LLM OUTPUT TOO LARGE:", model);
        try { proc.kill("SIGKILL"); } catch {}
        resolve(output.trim());
      }
    });

    // Ignore spinner junk
    proc.stderr.on("data", () => {});

    proc.on("error", err => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      debug("LLM PROCESS ERROR:", err?.message);
      resolve(output.trim() || null);
    });

    proc.on("close", code => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      debug("LLM EXIT:", model, "code:", code);
      resolve(output.trim() || null);
    });
  });
}

/* ================= EXPORT ================= */

module.exports = { runLLM };










// /**
//  * LLM Runner — ACTUALLY BULLETPROOF (Ollama Correct)
//  *
//  * - Uses STDIN correctly (REQUIRED by Ollama)
//  * - Closes stdin (prevents hangs)
//  * - Serialized (Windows safe)
//  * - Ignores spinner junk
//  * - No crashes, no fake timeouts
//  */

// const { spawn } = require("child_process");

// const HARD_TIMEOUT = 50000;
// const MAX_OUTPUT_SIZE = 1000 * 1024;

// const LLM_DEBUG = process.env.LLM_DEBUG === "true";
// const debug = (...a) => LLM_DEBUG && console.log("[LLM_DEBUG]", ...a);



// function isIncomplete(text) {
//   if (!text || typeof text !== "string") return true;

//   const t = text.trim();

//   // Ends abruptly
//   if (/[,:;(\[]$/.test(t)) return true;

//   // Logical connectors hanging
//   if (/\b(if|because|when|which|that|so)\s*$/i.test(t)) return true;

//   // No sentence termination
//   if (!/[.!?]$/.test(t)) return true;

//   // Unbalanced parentheses
//   const openParens = (t.match(/\(/g) || []).length;
//   const closeParens = (t.match(/\)/g) || []).length;

//   return openParens !== closeParens;
// }
// /* ================= SERIAL QUEUE ================= */

// let BUSY = false;
// const QUEUE = [];

// function runLLM(params) {
//   return new Promise(resolve => {
//     QUEUE.push({ params, resolve });
//     pump();
//   });
// }

// async function pump() {
//   if (BUSY || QUEUE.length === 0) return;

//   BUSY = true;
//   const { params, resolve } = QUEUE.shift();

//   try {
//     const result = await runInternal(params);
//     resolve(result);
//   } catch {
//     resolve(null);
//   } finally {
//     BUSY = false;
//     pump();
//   }
// }

// /* ================= CORE ================= */

// function runInternal({ model, prompt, timeout = HARD_TIMEOUT }) {
//   return new Promise(resolve => {
//     let output = "";
//     let finished = false;

//     let proc;
//     try {
//       proc = spawn(
//         "ollama",
//         ["run", model],
//         {
//           stdio: ["pipe", "pipe", "pipe"],
//           windowsHide: true
//         }
//       );
//     } catch (err) {
//       debug("SPAWN FAILED:", err?.message);
//       return resolve(null);
//     }

//     if (!proc?.stdin || !proc?.stdout || !proc?.stderr) {
//       debug("INVALID PROCESS");
//       return resolve(null);
//     }

//     debug("Spawn Ollama:", model);

//     /* 🔑 WRITE PROMPT + CLOSE STDIN (CRITICAL) */
//     proc.stdin.write(prompt);
//     proc.stdin.end();

//     const killTimer = setTimeout(() => {
//       if (finished) return;
//       finished = true;
//       debug("LLM HARD TIMEOUT:", model);
//       try { proc.kill("SIGKILL"); } catch {}
//       let result = output.trim();

//       if (result && isIncomplete(result)) {
//   debug("INCOMPLETE OUTPUT, CONTINUATION ATTEMPT");

//   const continuation = await runLLM({
//     model,
//     prompt: result + "\nContinue.",
//     timeout: Math.min(timeout, 15000)
//   });

//   if (typeof continuation === "string" && continuation.trim()) {
//     result = (result + " " + continuation).trim();
//   }
// }

//       resolve(result || null);
//     }, timeout);

//     proc.stdout.on("data", chunk => {
//       if (finished) return;

//       output += chunk.toString();

//       if (output.length > MAX_OUTPUT_SIZE) {
//         finished = true;
//         clearTimeout(killTimer);
//         debug("LLM OUTPUT TOO LARGE:", model);
//         try { proc.kill("SIGKILL"); } catch {}
//         resolve(output.trim());
//       }
//     });

//     // Ignore spinner junk (⠼⠴⠦ etc)
//     proc.stderr.on("data", () => {});

//     proc.on("error", err => {
//       if (finished) return;
//       finished = true;
//       clearTimeout(killTimer);
//       debug("LLM PROCESS ERROR:", err?.message);
//       resolve(output.trim() || null);
//     });

//     proc.on("close", code => {
//       if (finished) return;
//       finished = true;
//       clearTimeout(killTimer);
//       debug("LLM EXIT:", model, "code:", code);
//       resolve(output.trim() || null);
//     });
//   });
// }

// module.exports = { runLLM };