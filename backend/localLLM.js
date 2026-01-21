const { spawn } = require("child_process");

const OLLAMA_PATH =
  "C:\\Users\\athar\\AppData\\Local\\Programs\\Ollama\\ollama.exe";


/* ================= SAFE OUTPUT STRIPPER ================= */
/**
 * Removes chain-of-thought and internal artifacts
 * WITHOUT damaging valid user-facing content
 */
function stripThinking(text) {
  if (!text || typeof text !== "string") return null;

  return text
    // <think>...</think>
    .replace(/<think>[\s\S]*?<\/think>/gi, "")

    // Explicit reasoning headers ONLY at start
    .replace(/^(thinking|analysis|reasoning)\s*:/i, "")
    .replace(/^(final answer|answer|conclusion)\s*:/i, "")

    // Code blocks only (do NOT strip symbols globally)
    .replace(/```[\s\S]*?```/g, "")

    // Normalize whitespace safely
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}


/* ================= LOCAL LLM CALL ================= */

module.exports = function askLocalLLM(prompt, options = {}) {
  const {
    model = "llama3",      // safe default
    timeout = 20000,       // 20s hard stop
    maxOutput = 6000       // 🔒 HARD OUTPUT CAP
  } = options;

  return new Promise((resolve) => {
    let output = "";
    let finished = false;

    const ollama = spawn(
      OLLAMA_PATH,
      ["run", model],
      {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    /* ⏱ HARD TIMEOUT */
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        ollama.kill("SIGKILL");
        resolve(null);
      }
    }, timeout);

    /* 📤 SEND PROMPT (explicit termination) */
    ollama.stdin.write(prompt + "\n");
    ollama.stdin.end();

    /* 📥 COLLECT OUTPUT (with size guard) */
    ollama.stdout.on("data", (data) => {
      if (finished) return;

      output += data.toString();

      if (output.length > maxOutput) {
        finished = true;
        ollama.kill("SIGKILL");
        clearTimeout(timer);
        resolve(stripThinking(output.slice(0, maxOutput)));
      }
    });

    /* 🔇 Ignore stderr (Ollama logs only) */
    ollama.stderr.on("data", () => {});

    /* ✅ NORMAL EXIT */
    ollama.on("close", () => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);

      const cleaned = stripThinking(output);
      resolve(cleaned && cleaned.length ? cleaned : null);
    });

    /* ❌ SPAWN FAILURE */
    ollama.on("error", () => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
};






// const { spawn } = require("child_process");

// const OLLAMA_PATH =
//   "C:\\Users\\athar\\AppData\\Local\\Programs\\Ollama\\ollama.exe";

// /**
//  * Strip chain-of-thought / reasoning safely
//  * Ensures ONLY final user-facing text is returned
//  */
// function stripThinking(text) {
//   if (!text || typeof text !== "string") return null;

//   return text
//     // <think>...</think>
//     .replace(/<think>[\s\S]*?<\/think>/gi, "")

//     // Common reasoning headers
//     .replace(/^(thinking|analysis|reasoning)[\s\S]*?:/gi, "")
//     .replace(/^(final answer|answer|conclusion)\s*:/gi, "")

//     // Code blocks / markdown
//     .replace(/```[\s\S]*?```/g, "")
//     .replace(/[*#_`>-]/g, "")

//     // Normalize whitespace
//     .replace(/\n{2,}/g, "\n")
//     .replace(/\s{2,}/g, " ")
//     .trim();
// }

// module.exports = function askLocalLLM(prompt, options = {}) {
//   const {
//     model = "llama3",      // ✅ SAFE DEFAULT (chat model)
//     timeout = 20000        // 20s hard limit
//   } = options;

//   return new Promise((resolve) => {
//     let output = "";
//     let finished = false;

//     const ollama = spawn(
//       OLLAMA_PATH,
//       ["run", model],
//       { shell: false }
//     );

//     // ⏱️ Hard timeout
//     const timer = setTimeout(() => {
//       if (!finished) {
//         ollama.kill("SIGKILL");
//         resolve(null);
//       }
//     }, timeout);

//     // Send prompt
//     ollama.stdin.write(prompt);
//     ollama.stdin.end();

//     // Collect output
//     ollama.stdout.on("data", (data) => {
//       output += data.toString();
//     });

//     // Ignore stderr (ollama logs / warnings)
//     ollama.stderr.on("data", () => {});

//     ollama.on("close", () => {
//       finished = true;
//       clearTimeout(timer);

//       const cleaned = stripThinking(output);
//       resolve(cleaned && cleaned.length ? cleaned : null);
//     });

//     ollama.on("error", () => {
//       finished = true;
//       clearTimeout(timer);
//       resolve(null);
//     });
//   });
// };










