/**
 * Local LLM Adapter
 *
 * PURPOSE:
 * - Thin wrapper over llmRunner
 * - Optional chain-of-thought stripping ONLY
 * - No execution logic duplication
 * - No formatting destruction
 */

const { runLLM } = require("./llmRunner");

/* ================= SAFE THINK STRIPPER ================= */

/**
 * Removes ONLY explicit chain-of-thought blocks.
 * Preserves:
 * - code blocks
 * - math
 * - formatting
 * - markdown
 */
function stripThinking(text) {
  if (!text || typeof text !== "string") return null;

  return text
    // Remove <think>...</think> blocks ONLY
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

/* ================= MAIN ================= */

async function askLocalLLM(prompt, options = {}) {
  const {
    model = "llama3",
    timeout = 30000,
    stripThoughts = true
  } = options;

  const raw = await runLLM({
    model,
    prompt,
    timeout
  });

  if (!raw) return null;

  const cleaned = stripThoughts ? stripThinking(raw) : raw;

  return cleaned && cleaned.length ? cleaned : null;
}

module.exports = { askLocalLLM };














// const { spawn } = require("child_process");

// const OLLAMA_PATH =
//   "C:\\Users\\athar\\AppData\\Local\\Programs\\Ollama\\ollama.exe";


// /* ================= SAFE OUTPUT STRIPPER ================= */
// /**
//  * Removes chain-of-thought and internal artifacts
//  * WITHOUT damaging valid user-facing content
//  */
// function stripThinking(text) {
//   if (!text || typeof text !== "string") return null;

//   return text
//     // <think>...</think>
//     .replace(/<think>[\s\S]*?<\/think>/gi, "")

//     // Explicit reasoning headers ONLY at start
//     .replace(/^(thinking|analysis|reasoning)\s*:/i, "")
//     .replace(/^(final answer|answer|conclusion)\s*:/i, "")

//     // Code blocks only (do NOT strip symbols globally)
//     .replace(/```[\s\S]*?```/g, "")

//     // Normalize whitespace safely
//     .replace(/\r/g, "")
//     .replace(/\n{3,}/g, "\n\n")
//     .replace(/\s{2,}/g, " ")
//     .trim();
// }


// /* ================= LOCAL LLM CALL ================= */

// module.exports = function askLocalLLM(prompt, options = {}) {
//   const {
//     model = "llama3",      // safe default
//     timeout = 20000,       // 20s hard stop
//     maxOutput = 6000       // 🔒 HARD OUTPUT CAP
//   } = options;

//   return new Promise((resolve) => {
//     let output = "";
//     let finished = false;

//     const ollama = spawn(
//       OLLAMA_PATH,
//       ["run", model],
//       {
//         shell: false,
//         stdio: ["pipe", "pipe", "pipe"]
//       }
//     );

//     /* ⏱ HARD TIMEOUT */
//     const timer = setTimeout(() => {
//       if (!finished) {
//         finished = true;
//         ollama.kill("SIGKILL");
//         resolve(null);
//       }
//     }, timeout);

//     /* 📤 SEND PROMPT (explicit termination) */
//     ollama.stdin.write(prompt + "\n");
//     ollama.stdin.end();

//     /* 📥 COLLECT OUTPUT (with size guard) */
//     ollama.stdout.on("data", (data) => {
//       if (finished) return;

//       output += data.toString();

//       if (output.length > maxOutput) {
//         finished = true;
//         ollama.kill("SIGKILL");
//         clearTimeout(timer);
//         resolve(stripThinking(output.slice(0, maxOutput)));
//       }
//     });

//     /* 🔇 Ignore stderr (Ollama logs only) */
//     ollama.stderr.on("data", () => {});

//     /* ✅ NORMAL EXIT */
//     ollama.on("close", () => {
//       if (finished) return;

//       finished = true;
//       clearTimeout(timer);

//       const cleaned = stripThinking(output);
//       resolve(cleaned && cleaned.length ? cleaned : null);
//     });

//     /* ❌ SPAWN FAILURE */
//     ollama.on("error", () => {
//       if (finished) return;

//       finished = true;
//       clearTimeout(timer);
//       resolve(null);
//     });
//   });
// };



