/**
 * Arvsal Server
 * Deterministic-first command pipeline
 * LLM used ONLY where intended
 * Memory-safe
 * AI-mode persistent
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});

/* ================= OLLAMA WARMUP ================= */

const { warmAll } = require("./ollamaWarmup");
warmAll(); // DO NOT await

/* ================= MEMORY ================= */

const chatHistory = require("./chatHistory");
const episodicMemory = require("./episodicMemory");
const memory = require("./memory");

/* ================= CORE ================= */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
/* ================= CONFIRMATION ================= */

const {
  setConfirmation,
  getConfirmation,
  clearConfirmation
} = require("./confirmManager");

/* ================= BRAIN ================= */

const normalize = require("./normalizer");
const classifyIntent = require("./intentClassifier");
const { resolveIntentWithLLM } = require("./llmIntentRouter");
const { handleIntent } = require("./actions");
const applyPersonality = require("./personality");
const llmRouter = require("./llmRouter");
const { getWeather, getNews } = require("./localSkills");


/* ================= REFLECTION ================= */

const { maybeRunReflection } = require("./reflectionRunner");

/* ================= SYSTEM ACTIONS ================= */

const {
  openApp,
  openFolder,
  openCalendar,
  shutdown,
  restart,
  sleep,
  lock,
  volumeUp,
  volumeDown,
  mute,
  searchGoogle,
  openYouTube
} = require("./systemActions");

const NON_LLM_INTENTS = new Set([
  "LOCAL_SKILL",
  "OPEN_APP",
  "OPEN_FOLDER",
  "OPEN_CALENDAR",
  "SHUTDOWN",
  "RESTART",
  "LOCK",
  "SLEEP",
  "MUTE",
  "VOLUME_UP",
  "VOLUME_DOWN",
  "SEARCH",
  "YOUTUBE"
]);
/* ================= AI SWITCH ================= */

const {
  connectChatGPT,
  connectGemini,
  disconnectAI,
  getActiveAI
} = require("./aiSwitch");

/* ================= APP ================= */

const app = express();
app.use(cors());

// 🔥 raw audio MUST come before json
app.use("/audio", express.raw({
  type: ["audio/webm", "audio/wav", "application/octet-stream"],
  limit: "50mb"
}));

app.use(express.json());
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/* ================= HELPERS ================= */

function stripWakeWord(text = "") {
  return text
    .replace(/^hey\s+(arvsal|arsal|arsel|arsenal|harshal)\s*/i, "")
    .trim();
}

/* ================= MEMORY CONFIDENCE DECAY ================= */

try { memory.decayConfidence(); } catch {}
setInterval(() => {
  try { memory.decayConfidence(); } catch {}
}, 6 * 60 * 60 * 1000);

/* ================= AUDIO (WHISPER) ================= */

app.post("/audio",async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.json({ error: "Empty audio buffer" });
      }

      const base = `arvsal_${Date.now()}`;
      const webmPath = path.join(os.tmpdir(), `${base}.webm`);
      const wavPath  = path.join(os.tmpdir(), `${base}.wav`);

      // 1️⃣ write WEBM exactly as received
      fs.writeFileSync(webmPath, req.body);

      // 2️⃣ convert WEBM → WAV (16kHz mono)
      const ffmpegExe =
        "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe";

      await new Promise((resolve, reject) => {
        const ff = spawn(ffmpegExe, [
          "-y",
          "-i", webmPath,
          "-ar", "16000",
          "-ac", "1",
          wavPath
        ]);

        ff.on("close", code => {
          code === 0 ? resolve() : reject(new Error("ffmpeg failed"));
        });
      });

      // 3️⃣ run whisper on REAL wav
      const whisperExe = path.resolve(
        __dirname,
        "../whisper.cpp/build/bin/whisper-cli.exe"
      );

      const modelPath = path.resolve(
        __dirname,
        "../whisper.cpp/models/ggml-small.en.bin"
      );

      let output = "";

      const whisper = spawn(whisperExe, [
        "-m", modelPath,
        "-f", wavPath
      ]);

      whisper.stdout.on("data", d => {
        output += d.toString();
      });
      whisper.stderr.on("data", () => {});

      whisper.on("close", () => {
        fs.unlinkSync(webmPath);
        fs.unlinkSync(wavPath);

        const text = output
          .split("\n")
          .filter(l => l.includes("]"))
          .map(l => l.replace(/^.*\]\s*/, ""))
          .join(" ")
          .trim();

        res.json({ text });
      });

    } catch (err) {
      console.error("AUDIO ERROR:", err);
      res.json({
        error: "Audio processing failed",
        details: err.message
      });
    }
  }
);

/* ================= TTS (PIPER) ================= */

app.post("/speak", async (req, res) => {
  try {
    const text = req.body?.text;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "No text provided" });
    }

    const base = `arvsal_tts_${Date.now()}`;
    const wavPath = path.join(os.tmpdir(), `${base}.wav`);

    const piperExe =
      "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\piper.exe";

    const modelPath =
      "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\en_US-ryan-high.onnx";

    const piper = spawn(piperExe, [
      "-m", modelPath,
      "-f", wavPath
    ]);

    piper.stdin.write(text);
    piper.stdin.end();

    piper.on("close", () => {
      const audio = fs.readFileSync(wavPath);
      fs.unlinkSync(wavPath);

      res.set("Content-Type", "audio/wav");
      res.send(audio);
    });

  } catch (err) {
    console.error("PIPER ERROR:", err);
    res.status(500).json({ error: "TTS failed" });
  }
});
/* ================= COMMAND ENDPOINT ================= */

app.post("/command", async (req, res) => {
  const rawInput =
    req.body.command ??
    req.body.text ??
    req.body.message ??
    "";

  if (!rawInput || typeof rawInput !== "string") {
    return res.json({ reply: "" });
  }

  /* ---------- NORMALIZATION ---------- */

const normalized = normalize(rawInput);

// 🔒 FORCE spoken + typed to behave identically
const cleanRawText = stripWakeWord(normalized.rawText);
const cleanNormalizedText = stripWakeWord(
  normalized.normalizedText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")   // 🔥 remove punctuation
    .trim()
);
  let intentObj = null; // ✅ declare first (VERY IMPORTANT)

  /* ---------- CHAT HISTORY (USER) ---------- */

  chatHistory.addMessage("user", cleanRawText);

  const emotional =
    /\b(wasted|tired|sad|happy|free|love|hate|stress|enjoy)\b/i.test(cleanRawText);

  await episodicMemory.store({
    type: "conversation",
    subject: "user",
    value: cleanRawText,
    source: "user",
    importance: emotional ? 0.75 : 0.65
  });
  /* ---------- INTENT (RULES FIRST) ---------- */

  if (!intentObj) {
    intentObj = classifyIntent({
      rawText: cleanRawText,
      normalizedText: cleanNormalizedText
    });
  }
  /* ---------- CONFIRMATION (ABSOLUTE PRIORITY) ---------- */

  const pending = getConfirmation();
  if (pending) {
    if (intentObj.intent === "CONFIRM_YES") {
      clearConfirmation();
      pending.execute?.();
      const reply = "Okay, confirmed.";
      chatHistory.addMessage("arvsal", reply);
      return res.json({ reply });
    }

    if (intentObj.intent === "CONFIRM_NO") {
      clearConfirmation();
      const reply = "Okay, cancelled.";
      chatHistory.addMessage("arvsal", reply);
      return res.json({ reply });
    }

    const reply = "Please say yes or no.";
    chatHistory.addMessage("arvsal", reply);
    return res.json({ reply });
  }

  /* ---------- DETERMINISTIC INTENTS (NO LLM EVER) ---------- */

  if ([
    "INTRODUCE_SELF",
    "REMEMBER",
    "RECALL",
    "FORGET",
    "MEMORY_SUMMARY",
    "DAY_RECALL",
    "EPISODIC_RECALL",
    "EPISODIC_BY_DATE",
    "META_MEMORY"
  ].includes(intentObj.intent)) {
    const reply = await handleIntent(intentObj);
    chatHistory.addMessage("arvsal", reply);
    return res.json({ reply });
  }

  /* ---------- SAFE LLM INTENT FALLBACK ---------- */

  // if (
  //   intentObj.intent === "GENERAL_QUESTION" &&
  //   cleanRawText.length > 5 &&
  //   !/^(hi|hello|hey)$/i.test(cleanRawText) &&
  //   !intentObj.skill // ⛔ prevent LOCAL_SKILL override
  // ) {
  //   const llmIntent = await resolveIntentWithLLM(cleanRawText);
  //   if (llmIntent?.intent) intentObj = llmIntent;
  // }

  /* ---------- MAIN EXECUTION ---------- */

  let reply = "";
  let skipEpisodic = false;
  let skipPersonality = false;

  try {
    switch (intentObj.intent) {

      /* ===== AI MODE ===== */

      case "CONNECT_CHATGPT":
        connectChatGPT();
        reply = "Switched to ChatGPT.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "CONNECT_GEMINI":
        connectGemini();
        reply = "Switched to Gemini.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "DISCONNECT_AI":
        disconnectAI();
        reply = "Disconnected from external AI.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      /* ===== LOCAL SKILLS ===== */

      case "LOCAL_SKILL":
        skipPersonality = true;

        if (intentObj.skill === "WEATHER") {
          reply = await getWeather(intentObj.city);
        } else if (intentObj.skill === "NEWS") {
          reply = await getNews();
        } else {
          reply = await handleIntent(intentObj);
        }

        // ⚠️ IMPORTANT:
        // Allow episodic memory for meaningful local info
        skipEpisodic = false;
        break;

      /* ===== SYSTEM / APPS ===== */

      case "OPEN_APP":
        openApp(intentObj.app);
        reply = `Opening ${intentObj.app}.`;
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "OPEN_FOLDER":
        openFolder(intentObj.path);
        reply = "Opening folder.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "OPEN_CALENDAR":
        openCalendar();
        reply = "Opening calendar.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "SHUTDOWN":
        setConfirmation({ execute: shutdown });
        reply = "Are you sure you want to shut down?";
        skipEpisodic = true;
        break;

      case "RESTART":
        setConfirmation({ execute: restart });
        reply = "Are you sure you want to restart?";
        skipEpisodic = true;
        break;

      case "SLEEP":
        setConfirmation({ execute: sleep });
        reply = "Do you want to put the system to sleep?";
        skipEpisodic = true;
        break;

      case "LOCK":
        lock();
        reply = "System locked.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "VOLUME_UP":
        volumeUp();
        reply = "Volume increased.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "VOLUME_DOWN":
        volumeDown();
        reply = "Volume decreased.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "MUTE":
        mute();
        reply = "Volume muted.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "SEARCH":
        searchGoogle(intentObj.query);
        reply = `Searching for ${intentObj.query}.`;
        skipEpisodic = true;
        skipPersonality = true;
        break;

      case "YOUTUBE":
        openYouTube(intentObj.query || "");
        reply = "Opening YouTube.";
        skipEpisodic = true;
        skipPersonality = true;
        break;

      /* ===== GENERATIVE (LAST) ===== */
      case "CONFIRM_YES":
      case "CONFIRM_NO": {
        const pending = getConfirmation();

        if (!pending) {
          reply = intentObj.intent === "CONFIRM_NO"
            ? "Alright."
            : "Okay.";
          break;
        }

        if (intentObj.intent === "CONFIRM_NO") {
          clearConfirmation();
          reply = "Okay, cancelled.";
          break;
        }

        if (intentObj.intent === "CONFIRM_YES") {
          clearConfirmation();
          reply = await handleIntent(pending);
          break;
        }
      }

      case "SMALLTALK":
      case "GENERAL_QUESTION":
      case "CODING_QUERY":
      case "MATH_QUERY":

        // 🔒 HARD BLOCK — LLM must NEVER answer local/system intents
        if (NON_LLM_INTENTS.has(intentObj.intent)) {
          reply = "I'm not certain about that.";
          break;
        }

        reply = await llmRouter({
          intent: intentObj.intent,
          text: cleanRawText
        });

        if (!reply) {
          reply = getActiveAI() !== "local"
            ? `${getActiveAI().toUpperCase()} is temporarily unavailable.`
            : "I'm not certain about that.";
        }
        break;

      default:
        reply = "I'm not certain about that.";
    }

  } catch (err) {
    console.error("COMMAND ERROR:", err);
    reply = "Something went wrong.";
  }

  /* ---------- PERSONALITY ---------- */

  if (!skipPersonality) {
    reply = await applyPersonality(reply);
  }

  /* ---------- CHAT HISTORY ---------- */

  chatHistory.addMessage("arvsal", reply);
  if (["CONFIRM_YES", "CONFIRM_NO"].includes(intentObj.intent)) {
    skipEpisodic = true;
  }
  if (!skipEpisodic) {
    await episodicMemory.store({
      type: "response",
      subject: "arvsal",
      value: reply,
      source: "system",
      importance: 0.4
    });
  }

  /* ---------- REFLECTION ---------- */

  try { maybeRunReflection("user"); } catch {}

  res.json({ reply });
});

/* ================= START ================= */

app.listen(3000, () => {
  console.log("Arvsal backend running on http://localhost:3000");
});


