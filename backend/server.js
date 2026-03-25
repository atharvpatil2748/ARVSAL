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
const { extractKey } = require("./themeExtractor");

/* ================= CORE ================= */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");  // 🔥 THIS ONE
/* ================= CONFIRMATION ================= */

const {
  setConfirmation,
  getConfirmation,
  clearConfirmation
} = require("./confirmManager");

/* ================= PENDING SUGGESTION STATE ================= */
// Manages "type 1/2/3 to confirm" flow for content suggestions

let _pendingSuggestion = null;

function setPendingSuggestion(data) { _pendingSuggestion = data; }
function getPendingSuggestion() { return _pendingSuggestion; }
function clearPendingSuggestion() { _pendingSuggestion = null; }


/* ================= BRAIN ================= */

const normalize = require("./normalizer");
const classifyIntent = require("./intentClassifier");
const { handleIntent } = require("./actions");
const applyPersonality = require("./personality");
const llmRouter = require("./llmRouter");
const { getWeather, getNews } = require("./localSkills");
const { processMemoryQuery } = require("./cognitiveEngine");
const { generatePlan } = require("./plannerEngine");
const { runLLM } = require("./llmRunner");
const { isActionIntent } = require("./actionIntentDetector");
const { sendTelegramMessage, fetchUpdates, sendTelegramDocument,downloadTelegramFile, downloadTelegramFileToBuffer } = require("./telegramService");
const { enableRemote, disableRemote, isRemoteEnabled } = require("./remoteControl");
const { verifyToken } = require("./totpManager");
const { searchFileByName } = require("./fileSearch");
const screenshot = require("screenshot-desktop");
const { startWhatsApp, sendMessage } = require("./whatsappBridge");
const { enableBusy, disableBusy, isBusy, getBusyState } = require("./busyMode");
const { isVIP } = require("./vipList");
const { addMissed, formatSummary, clearMissed } = require("./missedTracker");
const { canAutoReply, resetCooldown } = require("./autoReplyGuard");
const { getContact, getAllContacts } = require("./contactBook");
const { takeAeyeSnap } = require("./visualService");
const visionRouter = require("./visionRouter");
const { runOCR } = require("./ocrRunner");
const { isTextHeavy } = require("./visionAnalyzer");
const sharp = require("sharp");
const { createTempFile, safeDelete, cleanupAll } = require("./utils/safeTempManager");
const interaction = require("./agent/interactionModeManager");
const conversionEngine = require("./conversionEngine");
const { classifyScreen } = require("./screenClassifier");
const { runFinalWhisper } = require("./whisperManager");


/* ================= VISION-DRIVEN ACTION LAYER (NEW) ================= */

const { handleScreenAction } = require("./screenActionOrchestrator");
const { agentLoop } = require("./agent/agentLoop");
const { suggestContent } = require("./contentSuggester");

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
  connectGroq,
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

async function analyzeScreen(prompt) {

  const tempPath = createTempFile("screen", ".png");
  const processedPath = createTempFile("screen_processed", ".png");

  let ocrText = "";
  let result;

  try {

    // 📸 Capture
    await screenshot({ filename: tempPath });

    // === First Pass: Cropped (Editor Optimized) ===
    await sharp(tempPath)
      .grayscale()
      .normalize()
      .sharpen()
      .extract({ left: 300, top: 100, width: 1200, height: 800 })
      .toFile(processedPath);

    ocrText = await runOCR(processedPath);

    console.log("CROPPED OCR LENGTH:", ocrText.length);

    // === Adaptive Retry If Weak ===
    if (ocrText.length < 300) {

      console.log("⚠️ Low OCR detected. Retrying full screen...");

      await sharp(tempPath)
        .grayscale()
        .normalize()
        .sharpen()
        .toFile(processedPath);

      ocrText = await runOCR(processedPath);

      console.log("FULL OCR LENGTH:", ocrText.length);
    }
    const screenType = classifyScreen(ocrText);
    console.log("SCREEN TYPE:", screenType);

    // ===== TEXT MODE =====
    if (isTextHeavy(ocrText)) {

      const textPrompt = `
      Screen context: ${screenType}

      You are performing technical screen analysis using raw OCR text.

      STRICT RULES:
      - Use ONLY extracted text
      - Be precise
      - Adapt explanation to the screen context (${screenType})
      - Do NOT speculate
      - Quote exact phrases

      Extracted Text:
      -------------------------
      ${ocrText}
      -------------------------

      User request:
      ${prompt || "Analyze and explain clearly."}
      `;
      
      result = await llmRouter({
        intent: "GENERAL_QUESTION",
        text: textPrompt
      });

      return result;
    }

    // ===== VISION FALLBACK =====
    result = await visionRouter({
      imagePath: tempPath,
      prompt: prompt || "Analyze precisely."
    });

    return result;

  } catch (err) {

    console.error("analyzeScreen error:", err.message);
    throw err;

  } finally {

    // ⭐ CLEANUP MUST NEVER THROW
    try { safeDelete(tempPath); } catch {}
    try { safeDelete(processedPath); } catch {}
  }
}

/* ================= MEMORY CONFIDENCE DECAY ================= */

try { memory.decayConfidence(); } catch {}
setInterval(() => {
  try { memory.decayConfidence(); } catch {}
}, 6 * 60 * 60 * 1000);

app.post("/audio",async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.json({ error: "Empty audio buffer" });
      }

      const base = `arvsal_${Date.now()}`;
      const webmPath = createTempFile("audio", ".webm");
      const wavPath  = createTempFile("audio", ".wav");

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


      safeDelete(webmPath);
      safeDelete(wavPath);

      // 🔥 Clean streaming state cleanly when a full audio submission occurs
      streamFullText = "";
      lastStreamTime = 0;

      res.json({ text: "" });

    } catch (err) {
      console.error("AUDIO ERROR:", err);
      res.json({
        error: "Audio processing failed",
        details: err.message
      });
    }
  }
);

let streamFullText = "";
let lastStreamTime = 0;

/* ================= PCM → WAV HELPER ================= */

/**
 * Converts a raw Int16 PCM buffer (16kHz, mono) into a valid WAV buffer.
 * Built entirely in memory — NO FFmpeg, NO disk I/O for the header.
 * @param {Buffer} pcmBuffer  Raw 16-bit little-endian PCM samples
 * @param {number} sampleRate Defaults to 16000 (whisper.cpp requirement)
 * @returns {Buffer} Complete WAV file buffer (header + data)
 */
function pcmToWav(pcmBuffer, sampleRate = 16000) {
  const numChannels  = 1;
  const bitsPerSample = 16;
  const byteRate     = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign   = numChannels * (bitsPerSample / 8);
  const dataSize     = pcmBuffer.length;
  const header       = Buffer.alloc(44);

  header.write("RIFF", 0);                          // ChunkID
  header.writeUInt32LE(36 + dataSize, 4);            // ChunkSize
  header.write("WAVE", 8);                          // Format
  header.write("fmt ", 12);                         // Subchunk1ID
  header.writeUInt32LE(16, 16);                      // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20);                       // AudioFormat (PCM = 1)
  header.writeUInt16LE(numChannels, 22);             // NumChannels
  header.writeUInt32LE(sampleRate, 24);              // SampleRate
  header.writeUInt32LE(byteRate, 28);                // ByteRate
  header.writeUInt16LE(blockAlign, 32);              // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);           // BitsPerSample
  header.write("data", 36);                         // Subchunk2ID
  header.writeUInt32LE(dataSize, 40);                // Subchunk2Size

  return Buffer.concat([header, pcmBuffer]);
}




/* ================= AUDIO/FINAL — Whisper Medium ================= */

const MEDIUM_MODEL_PATH = path.resolve(
  __dirname,
  "../whisper.cpp/models/ggml-medium.bin"
);

// Accepts the same raw WebM body as /audio.
// Runs ggml-medium for single blocking transcription.
app.post("/audio/final", async (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.json({ text: "" });
    }

    const webmPath = createTempFile("final", ".webm");
    const wavPath  = createTempFile("final", ".wav");

    fs.writeFileSync(webmPath, req.body);

    const ffmpegExe =
      "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe";

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegExe, [
        "-y", "-i", webmPath,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        wavPath
      ]);
      ff.on("close", code => code === 0 ? resolve() : reject(new Error("ffmpeg failed")));
    });

    safeDelete(webmPath);

    const fs_stats = require("fs").statSync(wavPath);
    if (fs_stats.size < 20000) {
        console.log("🚫 Skipping small audio file:", wavPath, "(", fs_stats.size, "bytes)");
        safeDelete(wavPath);
        return res.json({ text: "" });
    }

    const text = await runFinalWhisper(
      wavPath,
      MEDIUM_MODEL_PATH,
      [] // The required args (--language auto --translate --threads 8 --no-timestamps) are now hardcoded in the function.
    );

    let finalText = (text || "").trim();

    // 🚫 Prevent empty override
    if (!finalText) {
      console.log("⚠️ Large model failed");
      safeDelete(wavPath);
      return res.json({ text: null });
    }

    // 🚫 Remove any meta junk just in case
    finalText = finalText.replace(/\[.*?\]/g, "").trim();

    console.log("[audio/final] CLEAN:", finalText);

    safeDelete(wavPath);

    return res.json({ text: finalText });

  } catch (err) {
    console.error("[audio/final] error:", err.message);
    res.json({ text: "" });  // empty → frontend falls back to small model result
  }
});

/* ================= TTS (PIPER) ================= */


app.post("/speak", async (req, res) => {
  try {
    const text = req.body?.text;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "No text provided" });
    }

    const base = `arvsal_tts_${Date.now()}`;
    const wavPath = createTempFile("tts", ".wav");

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
      safeDelete(wavPath);

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

  const source = req.headers["x-source"] || "local";

  // ================= GLOBAL BUSY MODE =================

  const lower = rawInput.toLowerCase();

  // Enable busy
  if (lower.startsWith("busy ")) {

    // Format:
    // busy study 90
    // busy lecture 120

    const parts = lower.split(" ");
    const type = parts[1] || "busy";
    const minutes = parseInt(parts[2]) || 60;

    const freeAt = new Date(Date.now() + minutes * 60000);

    enableBusy(type, freeAt, async () => {

      const summary = formatSummary();

      await sendTelegramMessage(
        `⏰ Busy mode expired (${type}).\n\n${summary}`
      );

      await sendMessage("919699621635@c.us",
        `⏰ Busy mode expired (${type}).\n\n${summary}`
      );
      resetCooldown();

      clearMissed();
    });

    return res.json({
      reply: `Busy mode enabled: ${type}\nFree at ${freeAt.toLocaleTimeString()}`
    });
  }
  if (lower === "missed") {

    const summary = formatSummary();

    clearMissed();

    return res.json({ reply: summary });
  }

  // Disable busy
  if (lower === "free") {
    disableBusy();
    resetCooldown();
    return res.json({ reply: "Busy mode disabled." });
  }

  // Status
  if (lower === "status") {

    if (!isBusy()) {
      return res.json({ reply: "You are currently free." });
    }

    const state = getBusyState();

    return res.json({
      reply: `Current mode: ${state.type}\nFree at ${new Date(state.freeAt).toLocaleTimeString()}`
    });
  }

  // ================= DIRECT MESSAGE =================
  // Format:
  // message Rahul Hello bro

  if (lower.startsWith("message ")) {

    const parts = rawInput.split(" ");
    const name = parts[1];
    const content = parts.slice(2).join(" ");

    const number = getContact(name);

    if (!number) {
      return res.json({
        reply: `Unknown contact.\nAvailable: ${getAllContacts().join(", ")}`
      });
    }

    await sendMessage(number, content);

    return res.json({ reply: `Message sent to ${name}.` });
  }

  /* ---------- NORMALIZATION ---------- */

  const normalized = normalize(rawInput);

  // 🔒 FORCE spoken + typed to behave identically
  let cleanRawText = stripWakeWord(normalized.rawText);
  const cleanNormalizedText = stripWakeWord(
    normalized.normalizedText
      .toLowerCase()
      .replace(/[^\w\s]/g, "")   // 🔥 remove punctuation
      .trim()
  );

  /* ---------- TELEGRAM ---------- */
  
  if (source === "telegram") {

    const parts = cleanRawText.split(" ");
    const lastWord = parts[parts.length - 1];

    const lower = cleanRawText.toLowerCase();

    const sensitiveCommands = [
      "enable remote",
      "disable remote",
      "shutdown",
      "restart",
      "send file",
      "screenshot"
    ];

    const isSensitive = sensitiveCommands.some(cmd =>
      lower.startsWith(cmd)
    );
    if (isSensitive) {

      if (!verifyToken(lastWord)) {
        // 🚨 INTRUDER ALERT: Trigger the A-Eye silently before replying
        // We use a non-awaited call or a separate try/catch so the reply isn't delayed
        takeAeyeSnap().catch(err => console.error("Intruder snap failed:", err));

        return res.json({ reply: "❌ Invalid or missing TOTP code. A-Eye scan initiated." });
      }

      // remove TOTP from command
      cleanRawText = parts.slice(0, -1).join(" ");
    }


    const updatedLower = cleanRawText.toLowerCase();

    if (updatedLower === "enable remote") {
      enableRemote();
      return res.json({ reply: "🔓 Remote control enabled." });
    }

    if (updatedLower === "disable remote") {
      disableRemote();
      return res.json({ reply: "🔒 Remote control disabled." });
    }

    if (!isRemoteEnabled()) {
      return res.json({ reply: "🚫 Remote control is disabled." });
    }
  }

  // 🔥 Telegram-specific file send trigger
  if (source === "telegram" && cleanRawText.toLowerCase().startsWith("send file")) {

    const keyword = cleanRawText.replace(/send file/i, "").trim();

    const filePath = searchFileByName(keyword);

    if (!filePath) {
      return res.json({ reply: "File not found." });
    }

    await sendTelegramDocument(filePath);

    return res.json({ reply: "File sent successfully." });
  }

  if (source === "telegram" && cleanRawText.toLowerCase().startsWith("screenshot")) {

    const tempPath = createTempFile("telegram_screen", ".png");

    await screenshot({ filename: tempPath });
    await new Promise(r => setTimeout(r, 200));

    await sendTelegramDocument(tempPath);

    safeDelete(tempPath);

    return res.json({ reply: "Screenshot sent and deleted locally." });
  }

  /* ---------- SCREEN ANALYSIS ---------- */

  if (lower.startsWith("analyze screen")) {

  let prompt = rawInput
    .replace(/analyze screen/i, "")
    .replace(/[^\w\s]/g, "")   // remove punctuation
    .trim();

  if (!prompt || prompt.length < 3) {
    prompt = "Analyze and explain clearly.";
  }

  try {

    const result = await analyzeScreen(prompt);

    return res.json({ reply: result });

  } catch (err) {
    return res.json({ reply: "Vision analysis failed: " + err.message });
  }
}

  let intentObj = null; // ✅ declare first (VERY IMPORTANT)

  /* ---------- CHAT HISTORY (USER) ---------- */

  chatHistory.addMessage("user", cleanRawText);

  const emotional =
    /\b(wasted|tired|sad|happy|free|love|hate|stress|enjoy)\b/i.test(cleanRawText);

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

  /* ---------- PENDING SUGGESTION (1/2/3/none) ---------- */

  const _pendingSug = getPendingSuggestion();
  if (_pendingSug) {
    const rawNum = cleanRawText.trim();

    if (/^[1-3]$/.test(rawNum)) {
      const idx = parseInt(rawNum, 10) - 1;
      const chosen = _pendingSug.suggestions[idx];
      clearPendingSuggestion();

      if (chosen) {
        const { executeTool } = require("./tools/toolRegistry");
        await executeTool({
          tool: "desktop",
          action: "type",
          params: { text: chosen }
        });
        const reply = `Typed: "${chosen}"`;
        chatHistory.addMessage("arvsal", reply);
        return res.json({ reply });
      } else {
        const reply = "That option wasn't found. Try 1, 2, or 3.";
        chatHistory.addMessage("arvsal", reply);
        return res.json({ reply });
      }
    }

    if (/^none$/i.test(rawNum)) {
      clearPendingSuggestion();
      const reply = "Suggestion cancelled.";
      chatHistory.addMessage("arvsal", reply);
      return res.json({ reply });
    }
  }


  if ([
    "INTRODUCE_SELF",
    "REMEMBER",
    "RECALL",
    "FORGET",
    "MEMORY_SUMMARY",
    "DAY_RECALL",
    "EPISODIC_RECALL",
    "EPISODIC_BY_DATE",
    "SESSION_RECALL",
    "META_MEMORY"
  ].includes(intentObj.intent)) {
    const reply = await handleIntent(intentObj);
    chatHistory.addMessage("arvsal", reply);
    return res.json({ reply });
  }

/* ---------- COGNITIVE MEMORY LAYER (DEBUG MODE) ---------- */

if (
  intentObj.intent === "GENERAL_QUESTION" &&
  cleanRawText.length > 5
) {
  try {

    console.log("\n================ COGNITIVE DEBUG START ================");
    console.log("Query:", cleanRawText);

    const cognitive = await processMemoryQuery({
      text: cleanRawText
    });

    if (!cognitive || cognitive.recallStrength === 0) {

      console.log("COGNITIVE: No relevant memory found.");
      console.log("=======================================================\n");

    } else {

      console.log(
        "Recall Strength:",
        cognitive.recallStrength.toFixed(3)
      );

      console.log("\n--- Relevant Memory ---");

      cognitive.relevantMemory.forEach((item, i) => {
        console.log(
          `[${i + 1}] (${item.type}) ${item.value} | score=${item.confidence.toFixed(3)}`
        );
      });

      console.log("================= COGNITIVE DEBUG END =================\n");
    }

  } catch (err) {
    console.error("COGNITIVE ERROR:", err);
  }
}

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

      case "CONNECT_GROQ":
        connectGroq();
        reply = "Switched to Groq";
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

      case "WEBCAM_SNAP":
        if (source === "telegram") {
            try {
                // Call the new service
                await takeAeyeSnap();
                reply = "A-Eye scan complete. Image sent to your secure channel.";
            } catch (err) {
                reply = "A-Eye failed: " + err;
            }
        } else {
            reply = "Visual scanning is restricted to external secure channels.";
        }
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

      /* ===== SCREEN ACTION (Vision Automation Layer) ===== */

      case "SCREEN_ACTION": {
        interaction.setMode("action");
        skipEpisodic = true;
        skipPersonality = true;

        const actionResult = await agentLoop(intentObj.rawText);

        if (actionResult.needsClarification) {
          // Ask user before doing anything
          reply = actionResult.question;
          skipEpisodic = true;
        } else {
          reply = actionResult.response;
        }
        interaction.resetMode();
        break;
      }

      case "SCREEN_ACTION_MIXED": {
        interaction.setMode("mixed");
        // Mixed: chat response + screen action in parallel
        skipEpisodic = false;
        skipPersonality = false;

        const [chatReply, actionResult] = await Promise.all([
          llmRouter({ intent: "GENERAL_QUESTION", text: intentObj.rawText }),
          handleScreenAction(intentObj.rawText)
        ]);

        if (actionResult.needsClarification) {
          // If action needs info, prioritize asking over chat
          reply = actionResult.question;
          skipEpisodic = true;
        } else {
          const actionSummary = actionResult.success
            ? `\n\n✅ ${actionResult.response}`
            : `\n\n⚠️ ${actionResult.response}`;
          reply = (chatReply || "") + actionSummary;
        }
        interaction.resetMode();
        break;
      }

      case "SUGGEST_CONTENT": {
        interaction.setMode("suggestion");
        skipEpisodic = true;
        skipPersonality = true;

        // Capture screen for context
        const { captureScreen } = require("./screenCapture");
        const { runOCR } = require("./ocrRunner");
        const { classifyScreen } = require("./screenClassifier");

        let screenOCR = "";
        let screenType = "unknown";

        try {
          const cap = await captureScreen();
          if (cap) {
            screenOCR = await runOCR(cap.imagePath);
            screenType = classifyScreen(screenOCR);
          }
        } catch { /* ignore capture failures */ }

        const suggestResult = await suggestContent({
          screenText: screenOCR,
          screenType,
          userInstruction: intentObj.rawText
        });

        if (suggestResult.suggestions.length > 0) {
          // Store suggestions for follow-up confirmation
          setPendingSuggestion({
            suggestions: suggestResult.suggestions,
            screenType
          });
        }

        reply = suggestResult.response;
        interaction.resetMode();
        break;
      }

      case "CONFIRM_YES":
      case "CONFIRM_NO": {
        // ---- Check pending suggestion first ----
        const pendingSug = getPendingSuggestion();
        const rawNum = cleanRawText.trim();

        if (pendingSug && /^[1-3]$/.test(rawNum)) {
          const idx = parseInt(rawNum, 10) - 1;
          const chosen = pendingSug.suggestions[idx];
          clearPendingSuggestion();

          if (chosen) {
            // Type the chosen suggestion using desktop tool
            const { executeTool } = require("./tools/toolRegistry");
            await executeTool({
              tool: "desktop",
              action: "type",
              params: { text: chosen }
            });
            reply = `Typed: "${chosen}"`;
          } else {
            reply = "That option wasn't found. Try 1, 2, 3, or 'none' to cancel.";
          }
          skipEpisodic = true;
          skipPersonality = true;
          break;
        }

        if (pendingSug && /^none$/i.test(rawNum)) {
          clearPendingSuggestion();
          reply = "Suggestion cancelled.";
          skipEpisodic = true;
          skipPersonality = true;
          break;
        }

        // ---- Normal confirmation flow ----
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

        // 1️⃣ Try planner first
        let plan = null;

        if (isActionIntent(cleanRawText)) {
          try {
            plan = await generatePlan({
              userInput: cleanRawText
            });
          } catch (err) {
            console.log("Planner error:", err);
          }
        }

        // 2️⃣ If planner returned steps → execute
        if (
          plan &&
          Array.isArray(plan.steps) &&
          plan.steps.length > 0 &&
          plan.goal !== "unclear"
        ) {

        const { executeTool } = require("./tools/toolRegistry");
        const { evaluate } = require("./safety/riskEngine");

        const risk = evaluate(plan);

        if (!risk.allowed) {
          reply = "This action is blocked for safety.";
          break;
        }

        if (risk.requiresConfirmation) {
          reply = "This action requires confirmation.";
          break;
        }

        let executionResults = [];
        let allSuccess = true;
        const EXECUTABLE_TOOLS = ["system", "desktop", "n8n"];

        for (const step of plan.steps) {

          if (!EXECUTABLE_TOOLS.includes(step.tool)) {
            continue; // ignore non-executable tools
          }

          const result = await executeTool(step);
          executionResults.push(result);

          if (!result?.success) {
            allSuccess = false;
          }
        }

        /* ===== If any action failed ===== */
        if (!allSuccess) {

          const errors = executionResults
            .filter(r => !r.success)
            .map(r => r.error)
            .join(", ");

          reply = `I tried to execute that, but it failed: ${errors}`;
          break;
        }

        /* ===== If execution successful → generate natural confirmation ===== */

        if (plan.goal && plan.goal !== "unclear") {
          reply = `Action completed: ${plan.goal}`;
        } else {
          reply = "Action completed successfully.";
        }
        break;
      }

        // 3️⃣ Otherwise fallback to LLM chat
        reply = await llmRouter({
          intent: intentObj.intent,
          text: cleanRawText
        });

        if (!reply) {
          reply = "I'm not certain about that.";
        }

        break;

      default:
        reply = "I'm not certain about that.";
    }

  } catch (err) {
    console.error("COMMAND ERROR:", err);
    reply = "Something went wrong.";
  }

  /* ---------- EPISODIC STORE (CONVERSATION ONLY) ---------- */

  const conversational =
    intentObj.intent === "GENERAL_QUESTION" ||
    intentObj.intent === "SMALLTALK";

  if (conversational) {
    const themedKey = extractKey(cleanRawText);
    await episodicMemory.store({
      type: "conversation",
      subject: "user",
      // 🚫 "general" is noise — never let it become a dominant theme key
      key: themedKey !== "general" ? themedKey : null,
      value: cleanRawText,
      source: "user",
      importance: emotional ? 0.75 : 0.6
    });
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
  /* ---------- EPISODIC STORE (ASSISTANT) ---------- */

  if (conversational) {
    await episodicMemory.store({
      type: "response",
      subject: "arvsal",
      value: reply,
      source: "system",
      importance: 0.5
    });
  }

  /* ---------- REFLECTION (FIRE-AND-FORGET) ---------- */

  // 🔥 NEVER await — Mistral runs in background, response is immediate
  setImmediate(() => maybeRunReflection("user").catch(() => {}));
  res.json({ reply });
});


/* ================= START ================= */

app.listen(3000, () => {
  console.log("Arvsal backend running on http://localhost:3000");
});

process.on("exit", cleanupAll);
process.on("SIGINT", cleanupAll);
process.on("SIGTERM", cleanupAll);
process.on("uncaughtException", cleanupAll);


/* ================= WHATSAPP AUTOMATION ================= */

startWhatsApp(async (msg) => {

  const number = msg.from;
  const text = msg.body;

  // 🔒 SELF CONTROL CHANNEL
  if (number === "919699621635@c.us" && text.startsWith("@arvsal")) {
    console.log("CONTROL CHANNEL TRIGGERED:MESSAGE FROM WHATSAPP");
    const command = text.replace("@arvsal", "").trim();

    const response = await axios.post(
      "http://localhost:3000/command",
      { message: command },
      {
        headers: {
          "x-source": "whatsapp"
        }
      }
    );

    await sendMessage(number, response.data.reply);
    return;
  }

  // 🤖 BUSY MODE AUTO-REPLY
  if (isBusy() && isVIP(number)) {

    addMissed(number, text);

    if (!canAutoReply(number)) {
      return; // 🔒 skip auto reply if in cooldown
    }

    const state = getBusyState();

    const freeTime = new Date(state.freeAt);

    const relativeMinutes = Math.max(
      0,
      Math.round((freeTime.getTime() - Date.now()) / 60000)
    );

    const prompt = `
Atharv is currently in ${state.type}.
He will be free at ${freeTime.toLocaleTimeString()} 
(which is about ${relativeMinutes} minutes from now).

Write a short polite and humanly WhatsApp reply in third person,DO NOT use any other names despite of Atharv and Arvsal.
Add at bottom:

- Arvsal, AI assistant of Atharv
`;

    const aiReply = await runLLM({
      model: "llama3",
      prompt,
      timeout: 15000
    });

    // Human-like delay
    await new Promise(r => setTimeout(r, 4000 + Math.random()*4000));

    await sendMessage(number, aiReply);

    return;
  }

});

/* ================= TELEGRAM LISTENER ================= */

async function startTelegramListener() {
  console.log("📡 Telegram listener started...");

  let offset = 0;
  // 🔥 Declared outside the loop so it remembers your progress
  let userState = {}; 

  while (true) {
    try {
      const updates = await fetchUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const messageObj = update?.message;
        if (!messageObj) continue;

        const chatId = messageObj.chat?.id;

        // 🔒 THE GATEKEEPER: Strictly only for your Telegram ID
        if (String(chatId) !== process.env.TELEGRAM_CHAT_ID) {
            console.log(`⚠️ Blocked unauthorized access from: ${chatId}`);
            continue;
        }

        /* ================= 1. TEXT MESSAGE HANDLING ================= */

        if (messageObj.text) {
          const raw = messageObj.text.trim();

          // A. PDF Start Trigger
          if (raw.toLowerCase() === "@arvsal start pdf") {
            userState[chatId] = { mode: "PDF", step: "COLLECTING" };
            conversionEngine.startSession(chatId);
            await sendTelegramMessage("📥 A-Eye Batch Mode: ON. Send your mixed files. Type '@arvsal finish' when done.");
            continue; 
          }

          // B. Naming Step (The Final Hook)
          if (userState[chatId]?.step === "NAMING") {
              const pdfName = raw.replace("@arvsal", "").trim();
              await sendTelegramMessage(`⚙️ Finalizing ${pdfName}.pdf...`);
              
              try {
                  const finalPath = await conversionEngine.finalize(chatId, pdfName);
                  await sendTelegramDocument(finalPath);
                  setTimeout(() => safeDelete(finalPath), 1500);
                  delete userState[chatId];
                  await sendTelegramMessage("✅ Project complete. Workspace purged.");
              } catch (err) {
                  await sendTelegramMessage("❌ Engine Error: " + err.message);
              }
              continue; // 🔥 USE CONTINUE INSTEAD OF RETURN
          }



          // C. PDF Finish Trigger
          if (raw.toLowerCase() === "@arvsal finish") {
            if (userState[chatId]) {
              userState[chatId].step = "NAMING";
              await sendTelegramMessage("📝 What shall we name this PDF, sir?");
            } else {
              await sendTelegramMessage("🚫 No active batch session found.");
            }
            continue;
          }

          /* --- STANDARD COMMANDS (ONLY IF NO BATCH TRIGGERED) --- */
          if (!raw.toLowerCase().startsWith("@arvsal")) continue;

          const message = raw.replace(/^@arvsal/i, "").trim();
          console.log("📩 Telegram (validated):", message);

          const response = await axios.post(
            "http://localhost:3000/command",
            { message },
            { headers: { "x-source": "telegram" } }
          );

          await sendTelegramMessage(response.data.reply);
        }

        /* ================= 2. FILE/PHOTO HANDLING ================= */

        else if (messageObj.document || messageObj.photo) {
          let fileId = null;
          let fileName = null;

          if (messageObj.document) {
            fileId = messageObj.document.file_id;
            fileName = messageObj.document.file_name;
          } else if (messageObj.photo) {
            // Get highest resolution
            fileId = messageObj.photo[messageObj.photo.length - 1].file_id;
            fileName = `arvsal_img_${Date.now()}.jpg`;
          }

          if (fileId) {
              if (userState[chatId]?.step === "COLLECTING") {
                  const fileBuffer = await downloadTelegramFileToBuffer(fileId);
                  if (fileBuffer) {
                      // 🔥 CHANGE: Pass messageObj.message_id as the 4th argument
                      await conversionEngine.addFile(chatId, fileName, fileBuffer, messageObj.message_id);
                      console.log(`📎 Added to batch (ID: ${messageObj.message_id}): ${fileName}`);
                  } else {
                      await sendTelegramMessage(`⚠️ Failed to download ${fileName}. Skipping.`);
                  }
              }
          }

        }
      }

    } catch (err) {
      console.log("Telegram listener error:", err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}


startTelegramListener();






















// /**
//  * Arvsal Server
//  * Deterministic-first command pipeline
//  * LLM used ONLY where intended
//  * Memory-safe
//  * AI-mode persistent
//  */

// const path = require("path");
// require("dotenv").config({
//   path: path.resolve(__dirname, "../.env")
// });

// /* ================= OLLAMA WARMUP ================= */

// const { warmAll } = require("./ollamaWarmup");
// warmAll(); // DO NOT await

// /* ================= MEMORY ================= */

// const chatHistory = require("./chatHistory");
// const episodicMemory = require("./episodicMemory");
// const memory = require("./memory");
// const { extractKey } = require("./themeExtractor");

// /* ================= CORE ================= */

// const express = require("express");
// const cors = require("cors");
// const fs = require("fs");
// const os = require("os");
// const { spawn } = require("child_process");
// const axios = require("axios");
// const FormData = require("form-data");  // 🔥 THIS ONE
// /* ================= CONFIRMATION ================= */

// const {
//   setConfirmation,
//   getConfirmation,
//   clearConfirmation
// } = require("./confirmManager");

// /* ================= PENDING SUGGESTION STATE ================= */
// // Manages "type 1/2/3 to confirm" flow for content suggestions

// let _pendingSuggestion = null;
// let streamBuffer = Buffer.alloc(0);

// function setPendingSuggestion(data) { _pendingSuggestion = data; }
// function getPendingSuggestion() { return _pendingSuggestion; }
// function clearPendingSuggestion() { _pendingSuggestion = null; }


// /* ================= BRAIN ================= */

// const normalize = require("./normalizer");
// const classifyIntent = require("./intentClassifier");
// const { handleIntent } = require("./actions");
// const applyPersonality = require("./personality");
// const llmRouter = require("./llmRouter");
// const { getWeather, getNews } = require("./localSkills");
// const { processMemoryQuery } = require("./cognitiveEngine");
// const { generatePlan } = require("./plannerEngine");
// const { runLLM } = require("./llmRunner");
// const { isActionIntent } = require("./actionIntentDetector");
// const { sendTelegramMessage, fetchUpdates, sendTelegramDocument,downloadTelegramFile, downloadTelegramFileToBuffer } = require("./telegramService");
// const { enableRemote, disableRemote, isRemoteEnabled } = require("./remoteControl");
// const { verifyToken } = require("./totpManager");
// const { searchFileByName } = require("./fileSearch");
// const screenshot = require("screenshot-desktop");
// const { startWhatsApp, sendMessage } = require("./whatsappBridge");
// const { enableBusy, disableBusy, isBusy, getBusyState } = require("./busyMode");
// const { isVIP } = require("./vipList");
// const { addMissed, formatSummary, clearMissed } = require("./missedTracker");
// const { canAutoReply, resetCooldown } = require("./autoReplyGuard");
// const { getContact, getAllContacts } = require("./contactBook");
// const { takeAeyeSnap } = require("./visualService");
// const visionRouter = require("./visionRouter");
// const { runOCR } = require("./ocrRunner");
// const { isTextHeavy } = require("./visionAnalyzer");
// const sharp = require("sharp");
// const { createTempFile, safeDelete, cleanupAll } = require("./utils/safeTempManager");
// const interaction = require("./agent/interactionModeManager");
// const conversionEngine = require("./conversionEngine");
// const { classifyScreen } = require("./screenClassifier");


// /* ================= VISION-DRIVEN ACTION LAYER (NEW) ================= */

// const { handleScreenAction } = require("./screenActionOrchestrator");
// const { agentLoop } = require("./agent/agentLoop");
// const { suggestContent } = require("./contentSuggester");

// /* ================= REFLECTION ================= */

// const { maybeRunReflection } = require("./reflectionRunner");

// /* ================= SYSTEM ACTIONS ================= */

// const {
//   openApp,
//   openFolder,
//   openCalendar,
//   shutdown,
//   restart,
//   sleep,
//   lock,
//   volumeUp,
//   volumeDown,
//   mute,
//   searchGoogle,
//   openYouTube
// } = require("./systemActions");

// const NON_LLM_INTENTS = new Set([
//   "LOCAL_SKILL",
//   "OPEN_APP",
//   "OPEN_FOLDER",
//   "OPEN_CALENDAR",
//   "SHUTDOWN",
//   "RESTART",
//   "LOCK",
//   "SLEEP",
//   "MUTE",
//   "VOLUME_UP",
//   "VOLUME_DOWN",
//   "SEARCH",
//   "YOUTUBE"
// ]);
// /* ================= AI SWITCH ================= */

// const {
//   connectChatGPT,
//   connectGemini,
//   connectGroq,
//   disconnectAI,
//   getActiveAI
// } = require("./aiSwitch");

// /* ================= APP ================= */

// const app = express();
// app.use(cors());

// // 🔥 raw audio MUST come before json
// app.use("/audio", express.raw({
//   type: ["audio/webm", "audio/wav", "application/octet-stream"],
//   limit: "50mb"
// }));

// app.use(express.json());
// app.get("/health", (_req, res) => {
//   res.json({ status: "ok" });
// });

// /* ================= HELPERS ================= */

// function stripWakeWord(text = "") {
//   return text
//     .replace(/^hey\s+(arvsal|arsal|arsel|arsenal|harshal)\s*/i, "")
//     .trim();
// }

// async function analyzeScreen(prompt) {

//   const tempPath = createTempFile("screen", ".png");
//   const processedPath = createTempFile("screen_processed", ".png");

//   let ocrText = "";
//   let result;

//   try {

//     // 📸 Capture
//     await screenshot({ filename: tempPath });

//     // === First Pass: Cropped (Editor Optimized) ===
//     await sharp(tempPath)
//       .grayscale()
//       .normalize()
//       .sharpen()
//       .extract({ left: 300, top: 100, width: 1200, height: 800 })
//       .toFile(processedPath);

//     ocrText = await runOCR(processedPath);

//     console.log("CROPPED OCR LENGTH:", ocrText.length);

//     // === Adaptive Retry If Weak ===
//     if (ocrText.length < 300) {

//       console.log("⚠️ Low OCR detected. Retrying full screen...");

//       await sharp(tempPath)
//         .grayscale()
//         .normalize()
//         .sharpen()
//         .toFile(processedPath);

//       ocrText = await runOCR(processedPath);

//       console.log("FULL OCR LENGTH:", ocrText.length);
//     }
//     const screenType = classifyScreen(ocrText);
//     console.log("SCREEN TYPE:", screenType);

//     // ===== TEXT MODE =====
//     if (isTextHeavy(ocrText)) {

//       const textPrompt = `
//       Screen context: ${screenType}

//       You are performing technical screen analysis using raw OCR text.

//       STRICT RULES:
//       - Use ONLY extracted text
//       - Be precise
//       - Adapt explanation to the screen context (${screenType})
//       - Do NOT speculate
//       - Quote exact phrases

//       Extracted Text:
//       -------------------------
//       ${ocrText}
//       -------------------------

//       User request:
//       ${prompt || "Analyze and explain clearly."}
//       `;
      
//       result = await llmRouter({
//         intent: "GENERAL_QUESTION",
//         text: textPrompt
//       });

//       return result;
//     }

//     // ===== VISION FALLBACK =====
//     result = await visionRouter({
//       imagePath: tempPath,
//       prompt: prompt || "Analyze precisely."
//     });

//     return result;

//   } catch (err) {

//     console.error("analyzeScreen error:", err.message);
//     throw err;

//   } finally {

//     // ⭐ CLEANUP MUST NEVER THROW
//     try { safeDelete(tempPath); } catch {}
//     try { safeDelete(processedPath); } catch {}
//   }
// }

// /* ================= MEMORY CONFIDENCE DECAY ================= */

// try { memory.decayConfidence(); } catch {}
// setInterval(() => {
//   try { memory.decayConfidence(); } catch {}
// }, 6 * 60 * 60 * 1000);

// /* ================= AUDIO (WHISPER) ================= */

// // app.post("/audio", async (req, res) => {
// //   try {
// //     if (!req.body || !req.body.length) {
// //       return res.json({ error: "Empty audio buffer" });
// //     }

// //     const timestamp = Date.now();
// //     const webmPath = path.join(__dirname, `temp_${timestamp}.webm`);
// //     const wavPath = path.join(__dirname, `temp_${timestamp}.wav`);

// //     // 1️⃣ Write the incoming buffer
// //     fs.writeFileSync(webmPath, req.body);

// //     // 2️⃣ Convert to 16kHz Mono WAV (Standard for whisper.cpp)
// //     const ffmpegExe = "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe";

// //     await new Promise((resolve, reject) => {
// //       const ff = spawn(ffmpegExe, [
// //         "-y",
// //         "-i", webmPath,
// //         "-ar", "16000",
// //         "-ac", "1",
// //         wavPath
// //       ]);
// //       ff.on("close", code => code === 0 ? resolve() : reject(new Error("FFmpeg failed")));
// //     });

// //     // 3️⃣ Run the 3.1GB Large-v3 Model with "Hardened" Settings
// //     const whisperExe = path.resolve(__dirname, "../whisper.cpp/build/bin/whisper-cli.exe");
// //     const modelPath = "C:\\Users\\athar\\OneDrive\\Desktop\\arvsal\\whisper.cpp\\models\\ggml-large-v3.bin";

// //     let output = "";
    
// //     // Using a specific prompt to anchor Marathi/Hindi translations
// //     const internalPrompt = "Marathi and Hindi audio translated to English. Words like Mala, Sang, Tujha, Arvsal.";

// //     const whisper = spawn(whisperExe, [
// //       "-m", modelPath,
// //       "-f", wavPath,
// //       "-tr",              // 🚩 Translate to English
// //       "-nt",              // 🚩 No timestamps
// //       "-np",              // 🚩 No system logs in output
// //       "-dev", "0",        // 🚩 Use RTX 4060 GPU
// //       "-t", "8",          // 🚩 Use 8 CPU threads
// //       "-tpi", "0.0",      // 🚩 Temperature 0: Maximum consistency (Stops hallucinations)
// //       "-bs", "5",         // 🚩 Beam Size 5: High accuracy search for Marathi
// //       "--prompt", internalPrompt
// //     ]);

// //     whisper.stdout.on("data", (d) => {
// //       output += d.toString();
// //     });

// //     whisper.on("close", (code) => {
// //       // Cleanup temporary files immediately
// //       if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
// //       if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);

// //       if (code !== 0) {
// //         console.error("Whisper Error Code:", code);
// //         return res.json({ error: "Whisper processing failed" });
// //       }

// //       // 4️⃣ Advanced Scrubber: Remove hallucinations and "Prompt Leaks"
// //       let text = output.trim();
      
// //       // Words to remove if the model "repeats" your instructions
// //       const promptLeaks = [
// //         "marathi and hindi", 
// //         "assistant context", 
// //         "code-switching", 
// //         "arvsal assistant",
// //         "maladzau",
// //         "jani di"
// //       ];

// //       promptLeaks.forEach(word => {
// //         const regex = new RegExp(word, "gi");
// //         text = text.replace(regex, "");
// //       });

// //       // Remove specific "Silent Room" tokens
// //       text = text.replace(/\.|\-|_/g, "").trim();

// //       // Hallucination Filter for short/nonsense words
// //       const hallucinations = ["you", "thank you", "subtitles by", "watching"];
// //       const lowerText = text.toLowerCase();
      
// //       if (!text || hallucinations.includes(lowerText) || text.length < 3) {
// //         console.log("🤐 Silence/Hallucination discarded.");
// //         return res.json({ text: "" }); 
// //       }

// //       console.log(`✅ Final Cleaned Translation: ${text}`);
      
// //       // Send back to your Electron frontend
// //       res.json({ text });
// //     });

// //   } catch (err) {
// //     console.error("CRITICAL SERVER ERROR:", err);
// //     res.json({ error: "Audio processing failed", details: err.message });
// //   }
// // });


// app.post("/audio",async (req, res) => {
//     try {
//       if (!req.body || !req.body.length) {
//         return res.json({ error: "Empty audio buffer" });
//       }

//       const base = `arvsal_${Date.now()}`;
//       const webmPath = createTempFile("audio", ".webm");
//       const wavPath  = createTempFile("audio", ".wav");

//       // 1️⃣ write WEBM exactly as received
//       fs.writeFileSync(webmPath, req.body);

//       // 2️⃣ convert WEBM → WAV (16kHz mono)
//       const ffmpegExe =
//         "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe";

//       await new Promise((resolve, reject) => {
//         const ff = spawn(ffmpegExe, [
//           "-y",
//           "-i", webmPath,
//           "-ar", "16000",
//           "-ac", "1",
//           wavPath
//         ]);

//         ff.on("close", code => {
//           code === 0 ? resolve() : reject(new Error("ffmpeg failed"));
//         });
//       });

//       // 3️⃣ run whisper on REAL wav
//       const whisperExe = path.resolve(
//         __dirname,
//         "../whisper.cpp/build/bin/whisper-cli.exe"
//       );

//       const modelPath = path.resolve(
//         __dirname,
//         "../whisper.cpp/models/ggml-small.en.bin"
//       );

//       let output = "";

//       const whisper = spawn(whisperExe, [
//         "-m", modelPath,
//         "-f", wavPath
//       ]);

//       whisper.stdout.on("data", d => {
//         output += d.toString();
//       });
//       whisper.stderr.on("data", () => {});

//       whisper.on("close", () => {
//         safeDelete(webmPath);
//         safeDelete(wavPath);

//         const text = output
//           .split("\n")
//           .filter(l => l.includes("]"))
//           .map(l => l.replace(/^.*\]\s*/, ""))
//           .join(" ")
//           .trim();

//         res.json({ text });
//       });

//     } catch (err) {
//       console.error("AUDIO ERROR:", err);
//       res.json({
//         error: "Audio processing failed",
//         details: err.message
//       });
//     }
//   }
// );

// app.post("/audio-stream", async (req, res) => {
//   try {
//     if (!req.body || !req.body.length) {
//       return res.json({ text: "" });
//     }

//     // 🔥 Append incoming chunk
//     streamBuffer = Buffer.concat([streamBuffer, req.body]);

//     // 🔥 Keep only last ~3 seconds (avoid overload)
//     if (streamBuffer.length > 200000) {
//       streamBuffer = streamBuffer.slice(-200000);
//     }

//     const webmPath = createTempFile("stream", ".webm");
//     const wavPath  = createTempFile("stream", ".wav");

//     fs.writeFileSync(webmPath, streamBuffer);

//     const ffmpegExe =
//       "C:\\Users\\athar\\Downloads\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe";

//     // 🔄 Convert to WAV
//     await new Promise((resolve, reject) => {
//       const ff = spawn(ffmpegExe, [
//         "-y",
//         "-i", webmPath,
//         "-ar", "16000",
//         "-ac", "1",
//         wavPath
//       ]);

//       ff.on("close", code => {
//         code === 0 ? resolve() : reject();
//       });
//     });

//     const whisperExe = path.resolve(
//       __dirname,
//       "../whisper.cpp/build/bin/whisper-cli.exe"
//     );

//     const modelPath = path.resolve(
//       __dirname,
//       "../whisper.cpp/models/ggml-small.en.bin"
//     );

//     let output = "";

//     const whisper = spawn(whisperExe, [
//       "-m", modelPath,
//       "-f", wavPath,
//       "-nt"
//     ]);

//     whisper.stdout.on("data", d => {
//       output += d.toString();
//     });

//     whisper.on("close", () => {
//       safeDelete(webmPath);
//       safeDelete(wavPath);

//       const text = output
//         .split("\n")
//         .map(l => l.replace(/^.*\]\s*/, ""))
//         .join(" ")
//         .trim();

//       res.json({ text });
//     });

//   } catch (err) {
//     res.json({ text: "" });
//   }
// });


// /* ================= TTS (PIPER) ================= */

// app.post("/speak", async (req, res) => {
//   try {
//     const text = req.body?.text;
//     if (!text || typeof text !== "string") {
//       return res.status(400).json({ error: "No text provided" });
//     }

//     const base = `arvsal_tts_${Date.now()}`;
//     const wavPath = createTempFile("tts", ".wav");

//     const piperExe =
//       "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\piper.exe";

//     const modelPath =
//       "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper\\en_US-ryan-high.onnx";

//     const piper = spawn(piperExe, [
//       "-m", modelPath,
//       "-f", wavPath
//     ]);

//     piper.stdin.write(text);
//     piper.stdin.end();

//     piper.on("close", () => {
//       const audio = fs.readFileSync(wavPath);
//       safeDelete(wavPath);

//       res.set("Content-Type", "audio/wav");
//       res.send(audio);
//     });

//   } catch (err) {
//     console.error("PIPER ERROR:", err);
//     res.status(500).json({ error: "TTS failed" });
//   }
// });

// /* ================= COMMAND ENDPOINT ================= */

// app.post("/command", async (req, res) => {
//   const rawInput =
//     req.body.command ??
//     req.body.text ??
//     req.body.message ??
//     "";

//   if (!rawInput || typeof rawInput !== "string") {
//     return res.json({ reply: "" });
//   }

//   const source = req.headers["x-source"] || "local";

//   // ================= GLOBAL BUSY MODE =================

//   const lower = rawInput.toLowerCase();

//   // Enable busy
//   if (lower.startsWith("busy ")) {

//     // Format:
//     // busy study 90
//     // busy lecture 120

//     const parts = lower.split(" ");
//     const type = parts[1] || "busy";
//     const minutes = parseInt(parts[2]) || 60;

//     const freeAt = new Date(Date.now() + minutes * 60000);

//     enableBusy(type, freeAt, async () => {

//       const summary = formatSummary();

//       await sendTelegramMessage(
//         `⏰ Busy mode expired (${type}).\n\n${summary}`
//       );

//       await sendMessage("919699621635@c.us",
//         `⏰ Busy mode expired (${type}).\n\n${summary}`
//       );
//       resetCooldown();

//       clearMissed();
//     });

//     return res.json({
//       reply: `Busy mode enabled: ${type}\nFree at ${freeAt.toLocaleTimeString()}`
//     });
//   }
//   if (lower === "missed") {

//     const summary = formatSummary();

//     clearMissed();

//     return res.json({ reply: summary });
//   }

//   // Disable busy
//   if (lower === "free") {
//     disableBusy();
//     resetCooldown();
//     return res.json({ reply: "Busy mode disabled." });
//   }

//   // Status
//   if (lower === "status") {

//     if (!isBusy()) {
//       return res.json({ reply: "You are currently free." });
//     }

//     const state = getBusyState();

//     return res.json({
//       reply: `Current mode: ${state.type}\nFree at ${new Date(state.freeAt).toLocaleTimeString()}`
//     });
//   }

//   // ================= DIRECT MESSAGE =================
//   // Format:
//   // message Rahul Hello bro

//   if (lower.startsWith("message ")) {

//     const parts = rawInput.split(" ");
//     const name = parts[1];
//     const content = parts.slice(2).join(" ");

//     const number = getContact(name);

//     if (!number) {
//       return res.json({
//         reply: `Unknown contact.\nAvailable: ${getAllContacts().join(", ")}`
//       });
//     }

//     await sendMessage(number, content);

//     return res.json({ reply: `Message sent to ${name}.` });
//   }

//   /* ---------- NORMALIZATION ---------- */

//   const normalized = normalize(rawInput);

//   // 🔒 FORCE spoken + typed to behave identically
//   let cleanRawText = stripWakeWord(normalized.rawText);
//   const cleanNormalizedText = stripWakeWord(
//     normalized.normalizedText
//       .toLowerCase()
//       .replace(/[^\w\s]/g, "")   // 🔥 remove punctuation
//       .trim()
//   );

//   /* ---------- TELEGRAM ---------- */
  
//   if (source === "telegram") {

//     const parts = cleanRawText.split(" ");
//     const lastWord = parts[parts.length - 1];

//     const lower = cleanRawText.toLowerCase();

//     const sensitiveCommands = [
//       "enable remote",
//       "disable remote",
//       "shutdown",
//       "restart",
//       "send file",
//       "screenshot"
//     ];

//     const isSensitive = sensitiveCommands.some(cmd =>
//       lower.startsWith(cmd)
//     );
//     if (isSensitive) {

//       if (!verifyToken(lastWord)) {
//         // 🚨 INTRUDER ALERT: Trigger the A-Eye silently before replying
//         // We use a non-awaited call or a separate try/catch so the reply isn't delayed
//         takeAeyeSnap().catch(err => console.error("Intruder snap failed:", err));

//         return res.json({ reply: "❌ Invalid or missing TOTP code. A-Eye scan initiated." });
//       }

//       // remove TOTP from command
//       cleanRawText = parts.slice(0, -1).join(" ");
//     }


//     const updatedLower = cleanRawText.toLowerCase();

//     if (updatedLower === "enable remote") {
//       enableRemote();
//       return res.json({ reply: "🔓 Remote control enabled." });
//     }

//     if (updatedLower === "disable remote") {
//       disableRemote();
//       return res.json({ reply: "🔒 Remote control disabled." });
//     }

//     if (!isRemoteEnabled()) {
//       return res.json({ reply: "🚫 Remote control is disabled." });
//     }
//   }

//   // 🔥 Telegram-specific file send trigger
//   if (source === "telegram" && cleanRawText.toLowerCase().startsWith("send file")) {

//     const keyword = cleanRawText.replace(/send file/i, "").trim();

//     const filePath = searchFileByName(keyword);

//     if (!filePath) {
//       return res.json({ reply: "File not found." });
//     }

//     await sendTelegramDocument(filePath);

//     return res.json({ reply: "File sent successfully." });
//   }

//   if (source === "telegram" && cleanRawText.toLowerCase().startsWith("screenshot")) {

//     const tempPath = createTempFile("telegram_screen", ".png");

//     await screenshot({ filename: tempPath });
//     await new Promise(r => setTimeout(r, 200));

//     await sendTelegramDocument(tempPath);

//     safeDelete(tempPath);

//     return res.json({ reply: "Screenshot sent and deleted locally." });
//   }

//   /* ---------- SCREEN ANALYSIS ---------- */

//   if (lower.startsWith("analyze screen")) {

//   let prompt = rawInput
//     .replace(/analyze screen/i, "")
//     .replace(/[^\w\s]/g, "")   // remove punctuation
//     .trim();

//   if (!prompt || prompt.length < 3) {
//     prompt = "Analyze and explain clearly.";
//   }

//   try {

//     const result = await analyzeScreen(prompt);

//     return res.json({ reply: result });

//   } catch (err) {
//     return res.json({ reply: "Vision analysis failed: " + err.message });
//   }
// }

//   let intentObj = null; // ✅ declare first (VERY IMPORTANT)

//   /* ---------- CHAT HISTORY (USER) ---------- */

//   chatHistory.addMessage("user", cleanRawText);

//   const emotional =
//     /\b(wasted|tired|sad|happy|free|love|hate|stress|enjoy)\b/i.test(cleanRawText);

//   /* ---------- INTENT (RULES FIRST) ---------- */

//   if (!intentObj) {
//     intentObj = classifyIntent({
//       rawText: cleanRawText,
//       normalizedText: cleanNormalizedText
//     });
//   }

//   /* ---------- CONFIRMATION (ABSOLUTE PRIORITY) ---------- */

//   const pending = getConfirmation();
//   if (pending) {
//     if (intentObj.intent === "CONFIRM_YES") {
//       clearConfirmation();
//       pending.execute?.();
//       const reply = "Okay, confirmed.";
//       chatHistory.addMessage("arvsal", reply);
//       return res.json({ reply });
//     }

//     if (intentObj.intent === "CONFIRM_NO") {
//       clearConfirmation();
//       const reply = "Okay, cancelled.";
//       chatHistory.addMessage("arvsal", reply);
//       return res.json({ reply });
//     }

//     const reply = "Please say yes or no.";
//     chatHistory.addMessage("arvsal", reply);
//     return res.json({ reply });
//   }

//   /* ---------- PENDING SUGGESTION (1/2/3/none) ---------- */

//   const _pendingSug = getPendingSuggestion();
//   if (_pendingSug) {
//     const rawNum = cleanRawText.trim();

//     if (/^[1-3]$/.test(rawNum)) {
//       const idx = parseInt(rawNum, 10) - 1;
//       const chosen = _pendingSug.suggestions[idx];
//       clearPendingSuggestion();

//       if (chosen) {
//         const { executeTool } = require("./tools/toolRegistry");
//         await executeTool({
//           tool: "desktop",
//           action: "type",
//           params: { text: chosen }
//         });
//         const reply = `Typed: "${chosen}"`;
//         chatHistory.addMessage("arvsal", reply);
//         return res.json({ reply });
//       } else {
//         const reply = "That option wasn't found. Try 1, 2, or 3.";
//         chatHistory.addMessage("arvsal", reply);
//         return res.json({ reply });
//       }
//     }

//     if (/^none$/i.test(rawNum)) {
//       clearPendingSuggestion();
//       const reply = "Suggestion cancelled.";
//       chatHistory.addMessage("arvsal", reply);
//       return res.json({ reply });
//     }
//   }


//   if ([
//     "INTRODUCE_SELF",
//     "REMEMBER",
//     "RECALL",
//     "FORGET",
//     "MEMORY_SUMMARY",
//     "DAY_RECALL",
//     "EPISODIC_RECALL",
//     "EPISODIC_BY_DATE",
//     "SESSION_RECALL",
//     "META_MEMORY"
//   ].includes(intentObj.intent)) {
//     const reply = await handleIntent(intentObj);
//     chatHistory.addMessage("arvsal", reply);
//     return res.json({ reply });
//   }

// /* ---------- COGNITIVE MEMORY LAYER (DEBUG MODE) ---------- */

// if (
//   intentObj.intent === "GENERAL_QUESTION" &&
//   cleanRawText.length > 5
// ) {
//   try {

//     console.log("\n================ COGNITIVE DEBUG START ================");
//     console.log("Query:", cleanRawText);

//     const cognitive = await processMemoryQuery({
//       text: cleanRawText
//     });

//     if (!cognitive || cognitive.recallStrength === 0) {

//       console.log("COGNITIVE: No relevant memory found.");
//       console.log("=======================================================\n");

//     } else {

//       console.log(
//         "Recall Strength:",
//         cognitive.recallStrength.toFixed(3)
//       );

//       console.log("\n--- Relevant Memory ---");

//       cognitive.relevantMemory.forEach((item, i) => {
//         console.log(
//           `[${i + 1}] (${item.type}) ${item.value} | score=${item.confidence.toFixed(3)}`
//         );
//       });

//       console.log("================= COGNITIVE DEBUG END =================\n");
//     }

//   } catch (err) {
//     console.error("COGNITIVE ERROR:", err);
//   }
// }

//   /* ---------- MAIN EXECUTION ---------- */

//   let reply = "";
//   let skipEpisodic = false;
//   let skipPersonality = false;

//   try {
//     switch (intentObj.intent) {

//       /* ===== AI MODE ===== */

//       case "CONNECT_CHATGPT":
//         connectChatGPT();
//         reply = "Switched to ChatGPT.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "CONNECT_GEMINI":
//         connectGemini();
//         reply = "Switched to Gemini.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "CONNECT_GROQ":
//         connectGroq();
//         reply = "Switched to Groq";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "DISCONNECT_AI":
//         disconnectAI();
//         reply = "Disconnected from external AI.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       /* ===== LOCAL SKILLS ===== */

//       case "LOCAL_SKILL":
//         skipPersonality = true;

//         if (intentObj.skill === "WEATHER") {
//           reply = await getWeather(intentObj.city);
//         } else if (intentObj.skill === "NEWS") {
//           reply = await getNews();
//         } else {
//           reply = await handleIntent(intentObj);
//         }

//         // ⚠️ IMPORTANT:
//         // Allow episodic memory for meaningful local info
//         skipEpisodic = false;
//         break;

//       /* ===== SYSTEM / APPS ===== */

//       case "OPEN_APP":
//         openApp(intentObj.app);
//         reply = `Opening ${intentObj.app}.`;
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "OPEN_FOLDER":
//         openFolder(intentObj.path);
//         reply = "Opening folder.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "OPEN_CALENDAR":
//         openCalendar();
//         reply = "Opening calendar.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "SHUTDOWN":
//         setConfirmation({ execute: shutdown });
//         reply = "Are you sure you want to shut down?";
//         skipEpisodic = true;
//         break;

//       case "RESTART":
//         setConfirmation({ execute: restart });
//         reply = "Are you sure you want to restart?";
//         skipEpisodic = true;
//         break;

//       case "SLEEP":
//         setConfirmation({ execute: sleep });
//         reply = "Do you want to put the system to sleep?";
//         skipEpisodic = true;
//         break;

//       case "LOCK":
//         lock();
//         reply = "System locked.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "WEBCAM_SNAP":
//         if (source === "telegram") {
//             try {
//                 // Call the new service
//                 await takeAeyeSnap();
//                 reply = "A-Eye scan complete. Image sent to your secure channel.";
//             } catch (err) {
//                 reply = "A-Eye failed: " + err;
//             }
//         } else {
//             reply = "Visual scanning is restricted to external secure channels.";
//         }
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;


//       case "VOLUME_UP":
//         volumeUp();
//         reply = "Volume increased.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "VOLUME_DOWN":
//         volumeDown();
//         reply = "Volume decreased.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "MUTE":
//         mute();
//         reply = "Volume muted.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "SEARCH":
//         searchGoogle(intentObj.query);
//         reply = `Searching for ${intentObj.query}.`;
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       case "YOUTUBE":
//         openYouTube(intentObj.query || "");
//         reply = "Opening YouTube.";
//         skipEpisodic = true;
//         skipPersonality = true;
//         break;

//       /* ===== GENERATIVE (LAST) ===== */

//       /* ===== SCREEN ACTION (Vision Automation Layer) ===== */

//       case "SCREEN_ACTION": {
//         interaction.setMode("action");
//         skipEpisodic = true;
//         skipPersonality = true;

//         const actionResult = await agentLoop(intentObj.rawText);

//         if (actionResult.needsClarification) {
//           // Ask user before doing anything
//           reply = actionResult.question;
//           skipEpisodic = true;
//         } else {
//           reply = actionResult.response;
//         }
//         interaction.resetMode();
//         break;
//       }

//       case "SCREEN_ACTION_MIXED": {
//         interaction.setMode("mixed");
//         // Mixed: chat response + screen action in parallel
//         skipEpisodic = false;
//         skipPersonality = false;

//         const [chatReply, actionResult] = await Promise.all([
//           llmRouter({ intent: "GENERAL_QUESTION", text: intentObj.rawText }),
//           handleScreenAction(intentObj.rawText)
//         ]);

//         if (actionResult.needsClarification) {
//           // If action needs info, prioritize asking over chat
//           reply = actionResult.question;
//           skipEpisodic = true;
//         } else {
//           const actionSummary = actionResult.success
//             ? `\n\n✅ ${actionResult.response}`
//             : `\n\n⚠️ ${actionResult.response}`;
//           reply = (chatReply || "") + actionSummary;
//         }
//         interaction.resetMode();
//         break;
//       }

//       case "SUGGEST_CONTENT": {
//         interaction.setMode("suggestion");
//         skipEpisodic = true;
//         skipPersonality = true;

//         // Capture screen for context
//         const { captureScreen } = require("./screenCapture");
//         const { runOCR } = require("./ocrRunner");
//         const { classifyScreen } = require("./screenClassifier");

//         let screenOCR = "";
//         let screenType = "unknown";

//         try {
//           const cap = await captureScreen();
//           if (cap) {
//             screenOCR = await runOCR(cap.imagePath);
//             screenType = classifyScreen(screenOCR);
//           }
//         } catch { /* ignore capture failures */ }

//         const suggestResult = await suggestContent({
//           screenText: screenOCR,
//           screenType,
//           userInstruction: intentObj.rawText
//         });

//         if (suggestResult.suggestions.length > 0) {
//           // Store suggestions for follow-up confirmation
//           setPendingSuggestion({
//             suggestions: suggestResult.suggestions,
//             screenType
//           });
//         }

//         reply = suggestResult.response;
//         interaction.resetMode();
//         break;
//       }

//       case "CONFIRM_YES":
//       case "CONFIRM_NO": {
//         // ---- Check pending suggestion first ----
//         const pendingSug = getPendingSuggestion();
//         const rawNum = cleanRawText.trim();

//         if (pendingSug && /^[1-3]$/.test(rawNum)) {
//           const idx = parseInt(rawNum, 10) - 1;
//           const chosen = pendingSug.suggestions[idx];
//           clearPendingSuggestion();

//           if (chosen) {
//             // Type the chosen suggestion using desktop tool
//             const { executeTool } = require("./tools/toolRegistry");
//             await executeTool({
//               tool: "desktop",
//               action: "type",
//               params: { text: chosen }
//             });
//             reply = `Typed: "${chosen}"`;
//           } else {
//             reply = "That option wasn't found. Try 1, 2, 3, or 'none' to cancel.";
//           }
//           skipEpisodic = true;
//           skipPersonality = true;
//           break;
//         }

//         if (pendingSug && /^none$/i.test(rawNum)) {
//           clearPendingSuggestion();
//           reply = "Suggestion cancelled.";
//           skipEpisodic = true;
//           skipPersonality = true;
//           break;
//         }

//         // ---- Normal confirmation flow ----
//         const pending = getConfirmation();

//         if (!pending) {
//           reply = intentObj.intent === "CONFIRM_NO"
//             ? "Alright."
//             : "Okay.";
//           break;
//         }

//         if (intentObj.intent === "CONFIRM_NO") {
//           clearConfirmation();
//           reply = "Okay, cancelled.";
//           break;
//         }

//         if (intentObj.intent === "CONFIRM_YES") {
//           clearConfirmation();
//           reply = await handleIntent(pending);
//           break;
//         }
//       }

//       case "SMALLTALK":
//       case "GENERAL_QUESTION":
//       case "CODING_QUERY":
//       case "MATH_QUERY":

//         // 1️⃣ Try planner first
//         let plan = null;

//         if (isActionIntent(cleanRawText)) {
//           try {
//             plan = await generatePlan({
//               userInput: cleanRawText
//             });
//           } catch (err) {
//             console.log("Planner error:", err);
//           }
//         }

//         // 2️⃣ If planner returned steps → execute
//         if (
//           plan &&
//           Array.isArray(plan.steps) &&
//           plan.steps.length > 0 &&
//           plan.goal !== "unclear"
//         ) {

//         const { executeTool } = require("./tools/toolRegistry");
//         const { evaluate } = require("./safety/riskEngine");

//         const risk = evaluate(plan);

//         if (!risk.allowed) {
//           reply = "This action is blocked for safety.";
//           break;
//         }

//         if (risk.requiresConfirmation) {
//           reply = "This action requires confirmation.";
//           break;
//         }

//         let executionResults = [];
//         let allSuccess = true;
//         const EXECUTABLE_TOOLS = ["system", "desktop", "n8n"];

//         for (const step of plan.steps) {

//           if (!EXECUTABLE_TOOLS.includes(step.tool)) {
//             continue; // ignore non-executable tools
//           }

//           const result = await executeTool(step);
//           executionResults.push(result);

//           if (!result?.success) {
//             allSuccess = false;
//           }
//         }

//         /* ===== If any action failed ===== */
//         if (!allSuccess) {

//           const errors = executionResults
//             .filter(r => !r.success)
//             .map(r => r.error)
//             .join(", ");

//           reply = `I tried to execute that, but it failed: ${errors}`;
//           break;
//         }

//         /* ===== If execution successful → generate natural confirmation ===== */

//         if (plan.goal && plan.goal !== "unclear") {
//           reply = `Action completed: ${plan.goal}`;
//         } else {
//           reply = "Action completed successfully.";
//         }
//         break;
//       }

//         // 3️⃣ Otherwise fallback to LLM chat
//         reply = await llmRouter({
//           intent: intentObj.intent,
//           text: cleanRawText
//         });

//         if (!reply) {
//           reply = "I'm not certain about that.";
//         }

//         break;

//       default:
//         reply = "I'm not certain about that.";
//     }

//   } catch (err) {
//     console.error("COMMAND ERROR:", err);
//     reply = "Something went wrong.";
//   }

//   /* ---------- EPISODIC STORE (CONVERSATION ONLY) ---------- */

//   const conversational =
//     intentObj.intent === "GENERAL_QUESTION" ||
//     intentObj.intent === "SMALLTALK";

//   if (conversational) {
//     const themedKey = extractKey(cleanRawText);
//     await episodicMemory.store({
//       type: "conversation",
//       subject: "user",
//       // 🚫 "general" is noise — never let it become a dominant theme key
//       key: themedKey !== "general" ? themedKey : null,
//       value: cleanRawText,
//       source: "user",
//       importance: emotional ? 0.75 : 0.6
//     });
//   }
//   /* ---------- PERSONALITY ---------- */

//   if (!skipPersonality) {
//     reply = await applyPersonality(reply);
//   }

//   /* ---------- CHAT HISTORY ---------- */

//   chatHistory.addMessage("arvsal", reply);
//   if (["CONFIRM_YES", "CONFIRM_NO"].includes(intentObj.intent)) {
//     skipEpisodic = true;
//   }
//   /* ---------- EPISODIC STORE (ASSISTANT) ---------- */

//   if (conversational) {
//     await episodicMemory.store({
//       type: "response",
//       subject: "arvsal",
//       value: reply,
//       source: "system",
//       importance: 0.5
//     });
//   }

//   /* ---------- REFLECTION (FIRE-AND-FORGET) ---------- */

//   // 🔥 NEVER await — Mistral runs in background, response is immediate
//   setImmediate(() => maybeRunReflection("user").catch(() => {}));
//   res.json({ reply });
// });


// /* ================= START ================= */

// app.listen(3000, () => {
//   console.log("Arvsal backend running on http://localhost:3000");
// });

// process.on("exit", cleanupAll);
// process.on("SIGINT", cleanupAll);
// process.on("SIGTERM", cleanupAll);
// process.on("uncaughtException", cleanupAll);


// /* ================= WHATSAPP AUTOMATION ================= */

// startWhatsApp(async (msg) => {

//   const number = msg.from;
//   const text = msg.body;

//   // 🔒 SELF CONTROL CHANNEL
//   if (number === "919699621635@c.us" && text.startsWith("@arvsal")) {
//     console.log("CONTROL CHANNEL TRIGGERED:MESSAGE FROM WHATSAPP");
//     const command = text.replace("@arvsal", "").trim();

//     const response = await axios.post(
//       "http://localhost:3000/command",
//       { message: command },
//       {
//         headers: {
//           "x-source": "whatsapp"
//         }
//       }
//     );

//     await sendMessage(number, response.data.reply);
//     return;
//   }

//   // 🤖 BUSY MODE AUTO-REPLY
//   if (isBusy() && isVIP(number)) {

//     addMissed(number, text);

//     if (!canAutoReply(number)) {
//       return; // 🔒 skip auto reply if in cooldown
//     }

//     const state = getBusyState();

//     const freeTime = new Date(state.freeAt);

//     const relativeMinutes = Math.max(
//       0,
//       Math.round((freeTime.getTime() - Date.now()) / 60000)
//     );

//     const prompt = `
// Atharv is currently in ${state.type}.
// He will be free at ${freeTime.toLocaleTimeString()} 
// (which is about ${relativeMinutes} minutes from now).

// Write a short polite and humanly WhatsApp reply in third person,DO NOT use any other names despite of Atharv and Arvsal.
// Add at bottom:

// - Arvsal, AI assistant of Atharv
// `;

//     const aiReply = await runLLM({
//       model: "llama3",
//       prompt,
//       timeout: 15000
//     });

//     // Human-like delay
//     await new Promise(r => setTimeout(r, 4000 + Math.random()*4000));

//     await sendMessage(number, aiReply);

//     return;
//   }

// });

// /* ================= TELEGRAM LISTENER ================= */

// async function startTelegramListener() {
//   console.log("📡 Telegram listener started...");

//   let offset = 0;
//   // 🔥 Declared outside the loop so it remembers your progress
//   let userState = {}; 

//   while (true) {
//     try {
//       const updates = await fetchUpdates(offset);

//       for (const update of updates) {
//         offset = update.update_id + 1;

//         const messageObj = update?.message;
//         if (!messageObj) continue;

//         const chatId = messageObj.chat?.id;

//         // 🔒 THE GATEKEEPER: Strictly only for your Telegram ID
//         if (String(chatId) !== process.env.TELEGRAM_CHAT_ID) {
//             console.log(`⚠️ Blocked unauthorized access from: ${chatId}`);
//             continue;
//         }

//         /* ================= 1. TEXT MESSAGE HANDLING ================= */

//         if (messageObj.text) {
//           const raw = messageObj.text.trim();

//           // A. PDF Start Trigger
//           if (raw.toLowerCase() === "@arvsal start pdf") {
//             userState[chatId] = { mode: "PDF", step: "COLLECTING" };
//             conversionEngine.startSession(chatId);
//             await sendTelegramMessage("📥 A-Eye Batch Mode: ON. Send your mixed files. Type '@arvsal finish' when done.");
//             continue; 
//           }

//           // B. Naming Step (The Final Hook)
//           if (userState[chatId]?.step === "NAMING") {
//               const pdfName = raw.replace("@arvsal", "").trim();
//               await sendTelegramMessage(`⚙️ Finalizing ${pdfName}.pdf...`);
              
//               try {
//                   const finalPath = await conversionEngine.finalize(chatId, pdfName);
//                   await sendTelegramDocument(finalPath);
//                   setTimeout(() => safeDelete(finalPath), 1500);
//                   delete userState[chatId];
//                   await sendTelegramMessage("✅ Project complete. Workspace purged.");
//               } catch (err) {
//                   await sendTelegramMessage("❌ Engine Error: " + err.message);
//               }
//               continue; // 🔥 USE CONTINUE INSTEAD OF RETURN
//           }



//           // C. PDF Finish Trigger
//           if (raw.toLowerCase() === "@arvsal finish") {
//             if (userState[chatId]) {
//               userState[chatId].step = "NAMING";
//               await sendTelegramMessage("📝 What shall we name this PDF, sir?");
//             } else {
//               await sendTelegramMessage("🚫 No active batch session found.");
//             }
//             continue;
//           }

//           /* --- STANDARD COMMANDS (ONLY IF NO BATCH TRIGGERED) --- */
//           if (!raw.toLowerCase().startsWith("@arvsal")) continue;

//           const message = raw.replace(/^@arvsal/i, "").trim();
//           console.log("📩 Telegram (validated):", message);

//           const response = await axios.post(
//             "http://localhost:3000/command",
//             { message },
//             { headers: { "x-source": "telegram" } }
//           );

//           await sendTelegramMessage(response.data.reply);
//         }

//         /* ================= 2. FILE/PHOTO HANDLING ================= */

//         else if (messageObj.document || messageObj.photo) {
//           let fileId = null;
//           let fileName = null;

//           if (messageObj.document) {
//             fileId = messageObj.document.file_id;
//             fileName = messageObj.document.file_name;
//           } else if (messageObj.photo) {
//             // Get highest resolution
//             fileId = messageObj.photo[messageObj.photo.length - 1].file_id;
//             fileName = `arvsal_img_${Date.now()}.jpg`;
//           }

//           if (fileId) {
//             if (userState[chatId]?.step === "COLLECTING") {
//                 const fileBuffer = await downloadTelegramFileToBuffer(fileId);
//                 if (fileBuffer) { // 🔥 Only add if download was successful
//                     await conversionEngine.addFile(chatId, fileName, fileBuffer);
//                     console.log(`📎 Added to batch: ${fileName}`);
//                 } else {
//                     await sendTelegramMessage(`⚠️ Failed to download ${fileName}. Skipping.`);
//                 }
//             } else {
//                 // ... your standard logic
//             }
//           }

//         }
//       }

//     } catch (err) {
//       console.log("Telegram listener error:", err.message);
//       await new Promise(r => setTimeout(r, 3000));
//     }
//   }
// }


// startTelegramListener();


