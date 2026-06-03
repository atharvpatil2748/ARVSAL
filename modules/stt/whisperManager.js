const { execFile } = require("child_process");
const path = require("path");
const { isOnBattery } = require('@utils/powerMonitor');

const pathConfig = require('@utils/pathConfig');

const WHISPER_EXE = pathConfig.WHISPER_EXE;
const WHISPER_CWD = path.dirname(WHISPER_EXE); // bin/ — DLLs live here
const SMALL_MODEL_PATH = pathConfig.SMALL_MODEL_PATH;

// Max time whisper is allowed to run before force-killing
const TIMEOUT_FINAL_MS = 30000; // medium model — 30s (GPU model load + inference)
const TIMEOUT_SMALL_MS = 15000; // small model  — 15s

/**
 * Core whisper runner.
 *
 * Uses execFile (not spawn) so stdout/stderr are captured atomically — no
 * stream-buffering edge cases.  Paths are always resolved to absolute before
 * being passed to the binary, matching exactly what the terminal CLI does.
 */
function runWhisperWithTimeout(wavPath, modelPath, extraArgs = [], timeoutMs) {
  return new Promise((resolve) => {
    // ── Guarantee absolute paths ───────────────────────────────────────────
    const absWav   = path.resolve(wavPath);
    const absModel = path.resolve(modelPath);

    const useGPU = !isOnBattery();

    console.log(
      `🚀 Whisper START  model=${path.basename(absModel)}  wav=${absWav}  gpu=${useGPU}  timeout=${timeoutMs}ms`
    );

    // ── Build args — minimal set matching exact CLI usage ─────────────────
    // ONLY -m and -f are required.  Extra flags re-added carefully below.
    const args = [
      "-m", absModel,
      "-f", absWav,
      "--language", "auto",
      "--translate",
      "--no-timestamps",
      "--threads", "4",
      ...extraArgs,
    ];

    // GPU control — disabled when on battery
    if (!useGPU) {
      console.log("⚡ Battery mode → CPU-only");
      args.push("--no-gpu");
    } else {
      console.log("🔌 Plugged in → GPU");
    }

    console.log("[Whisper] exe:", WHISPER_EXE);
    console.log("[Whisper] args:", args.join(" "));
    console.log("[Whisper] cwd:", WHISPER_CWD);

    execFile(
      WHISPER_EXE,
      args,
      {
        cwd: WHISPER_CWD,       // run from bin/ so all DLLs are found
        timeout: timeoutMs,     // execFile kills automatically on timeout
        maxBuffer: 10 * 1024 * 1024, // 10 MB — plenty for any transcription
        windowsHide: true,      // suppress flash of console window
      },
      (err, stdout, stderr) => {
        // Log stderr — filter model load noise in production
        if (stderr) {
          const isDebug = process.env.ARVSAL_WAKE_DEBUG === '1';
          const NOISE_PATTERNS = [
            /whisper_model_load:/,
            /whisper_backend_init/,
            /whisper_print_timings/,
            /^n_/,
            /^\s*$/,
            /REPACK\s*=/,
            /PEER_MAX_BATCH/,
            /compute buffer/,
            /n_vocab/,
            /n_audio/,
            /n_text/,
            /n_mels/,
            /ggml_/,
            /found GPU device/,
            /using CUDA/,
            /processors,/,
            /qntvr/,
          ];
          stderr.trim().split('\n').forEach((l) => {
            const line = l.trim();
            if (!line) return;
            if (!isDebug && NOISE_PATTERNS.some(p => p.test(line))) return;
            console.log('[Whisper stderr]', line);
          });
        }

        if (err) {
          if (err.killed || err.code === "ETIMEDOUT") {
            console.warn(`⏰ Whisper TIMEOUT (${timeoutMs}ms) — process killed`);
          } else {
            console.error("❌ Whisper execFile error:", err.message);
          }
          return resolve("");
        }

        const text = stdout
          .split("\n")
          .map((l) => l.replace(/^.*\]\s*/, ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        console.log(`✅ Whisper END: "${text || "(empty)"}"`);
        resolve(text || "");
      }
    );
  });
}

/**
 * Run medium model for final transcription (primary path).
 */
function runFinalWhisper(wavPath, modelPath, extraArgs = []) {
  return runWhisperWithTimeout(wavPath, modelPath, extraArgs, TIMEOUT_FINAL_MS);
}

/**
 * Run small model for fallback / streaming transcription.
 */
function runSmallWhisper(wavPath, extraArgs = []) {
  return runWhisperWithTimeout(wavPath, SMALL_MODEL_PATH, extraArgs, TIMEOUT_SMALL_MS);
}

module.exports = { runFinalWhisper, runSmallWhisper, SMALL_MODEL_PATH };
