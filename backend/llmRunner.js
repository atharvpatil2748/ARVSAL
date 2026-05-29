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
const http = require("http");

/* ── Strip ANSI terminal escape codes (cursor movement, colors, etc.) ── */
function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

/* ============================================================
 * normalizeLLMOutput — Multi-stage transcript normalizer
 *
 * Directly extends the strategy from book/llm_processor.py.
 *
 * Stage 1: Whitespace repair
 *          Collapse multiple spaces, normalize line endings.
 *
 * Stage 2: Prefix-growth stutter removal
 *          "becom become" → "become"
 *          "usi using"    → "using"
 *          "o or"         → "or"
 *          Punctuation-stripped + case-insensitive before check.
 *
 * Stage 3: Exact adjacent duplicate collapse
 *          "to to"    → "to"
 *          "the the"  → "the"
 *          "Stark Stark" → "Stark"
 *
 * Stage 4: N-gram phrase-tail overlap removal (N=2,3)
 *          "within the MCU within the MCU" → "within the MCU"
 *          "Tony Stark Stark Industries"  handled by Stage 3
 *
 * Stage 5: Final whitespace normalization
 * ============================================================ */
function normalizeLLMOutput(text) {
  if (!text || typeof text !== "string") return text;

  const PUNCT_STRIP = /^[.,;:!?()\"'\-]+|[.,;:!?()\"'\-]+$/g;
  function sp(w) { return w.replace(PUNCT_STRIP, "").toLowerCase(); }

  // ── Stage 1: Whitespace repair ──────────────────────────────────────────
  let s = text
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")  // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();

  let words = s.split(/\s+/).filter(Boolean);

  // ── Stage 2: Prefix-growth stutter removal ──────────────────────────────
  // If words[i] is a strict, non-equal, case-insensitive prefix of words[i+1]
  // then words[i] is a decoder stutter — drop it.
  (function prefixStutter() {
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const wc = sp(words[i]);
      const nc = i + 1 < words.length ? sp(words[i + 1]) : null;
      if (nc !== null && wc.length > 0 && nc.length > wc.length && nc.startsWith(wc)) {
        continue; // stutter — skip
      }
      out.push(words[i]);
    }
    words = out;
  })();

  // ── Stage 3: Exact adjacent duplicate collapse ───────────────────────────
  // "to to", "the the", "Stark Stark" → collapsed to one.
  (function exactDuplicates() {
    const out = [];
    for (let i = 0; i < words.length; i++) {
      if (i > 0 && sp(words[i]) === sp(words[i - 1]) && sp(words[i]).length > 0) {
        continue; // duplicate — skip
      }
      out.push(words[i]);
    }
    words = out;
  })();

  // ── Stage 4: Phrase-tail N-gram overlap removal (N = 3 down to 2) ────────
  // Removes spans like "within the MCU within the MCU" → "within the MCU".
  // Runs iteratively until stable (handles cascaded overlaps).
  (function phraseOverlap() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let n = 3; n >= 2; n--) {
        for (let i = 0; i <= words.length - n * 2; i++) {
          const segA = words.slice(i,     i + n    ).map(sp).join(" ");
          const segB = words.slice(i + n, i + n * 2).map(sp).join(" ");
          if (segA === segB && segA.trim().length > 0) {
            words.splice(i + n, n); // remove the duplicate segment
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  })();

  // ── Stage 5: Final whitespace normalization ───────────────────────────────
  return words.join(" ").replace(/[^\S\n]+/g, " ").trim();
}

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

function runInternal({ model, prompt, timeout = HARD_TIMEOUT, isStructured = false }) {
  return new Promise(resolve => {
    let output = "";
    let finished = false;
    let didContinue = false;

    debug("Fetch Ollama API:", model);

    const req = http.request({
      hostname: "127.0.0.1",
      port: 11434,
      path: "/api/generate",
      method: "POST"
    }, res => {
      let buffer = "";

      res.on("data", chunk => {
        if (finished) return;
        
        buffer += chunk.toString();
        let lines = buffer.split("\n");
        buffer = lines.pop(); 
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) output += parsed.response;
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }

        if (output.length > MAX_OUTPUT_SIZE) {
          finished = true;
          clearTimeout(killTimer);
          debug("LLM OUTPUT TOO LARGE:", model);
          req.destroy();
          resolve(isStructured ? output.trim() : normalizeLLMOutput(output.trim()));
        }
      });

      res.on("end", () => {
        if (finished) return;
        finished = true;
        clearTimeout(killTimer);
        debug("LLM EXIT:", model, "code: 0");
        resolve((isStructured ? output.trim() : normalizeLLMOutput(output.trim())) || null);
      });
    });

    req.on("error", err => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      debug("LLM PROCESS ERROR:", err?.message);
      resolve(output.trim() || null);
    });

    // We can also pass temperature: 0.0 for structured output to ensure deterministic generation
    const payload = {
      model,
      prompt,
      stream: true,
      keep_alive: "120s"
    };
    
    if (isStructured) {
      payload.options = { temperature: 0.0, top_p: 0.9 };
    }

    req.write(JSON.stringify(payload));
    req.end();

    const killTimer = setTimeout(() => {
      if (finished) return;
      finished = true;

      debug("LLM HARD TIMEOUT:", model);
      req.destroy();

      let result = isStructured ? output.trim() : normalizeLLMOutput(output.trim());

      // 🔁 ONE safe continuation attempt
      if (!didContinue && result && isIncomplete(result)) {
        didContinue = true;
        debug("INCOMPLETE OUTPUT, CONTINUATION ATTEMPT");

        runLLM({
          model,
          prompt: result + "\nContinue.",
          timeout: Math.min(timeout, 30000),
          isStructured
        }).then(continuation => {
          if (typeof continuation === "string" && continuation.trim()) {
            if (isStructured) {
              result = result.trimEnd() + continuation;
            } else {
              // ── Overlap-aware merge ──────────────────────────────────────────
              const base = result.trimEnd();
              const cont = continuation.trimStart();
              const bLow = base.toLowerCase();
              const cLow = cont.toLowerCase();

              let merged = base + " " + cont; // default: no overlap found
              const maxCheck = Math.min(base.length, cont.length, 60);
              for (let len = maxCheck; len > 3; len--) {
                if (bLow.endsWith(cLow.substring(0, len))) {
                  merged = base + cont.substring(len);
                  break;
                }
              }
              result = merged;
            }
          }
          resolve(result || null);
        });

        return;
      }

      resolve(result || null);
    }, timeout);
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