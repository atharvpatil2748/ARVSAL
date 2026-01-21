// ================= ENV =================
require("dotenv").config();

// ================= MEMORY =================
const chatHistory = require("./chatHistory");
const episodicMemory = require("./episodicMemory");
const memory = require("./memory");

// ================= CORE =================
const express = require("express");
const cors = require("cors");

// ================= CONFIRMATION =================
const {
  setConfirmation,
  getConfirmation,
  clearConfirmation
} = require("./confirmManager");

// ================= BRAIN =================
const normalize = require("./normalizer");
const classifyIntent = require("./intentClassifier");
const { resolveIntentWithLLM } = require("./llmIntentRouter");
const { handleIntent } = require("./actions");
const applyPersonality = require("./personality");
const llmRouter = require("./llmRouter");

// ================= MEMORY REFLECTION =================
const { shouldReflect, reflect } = require("./reflect");

// ================= SYSTEM ACTIONS =================
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

// ================= APP =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= HELPERS =================
function stripWakeWord(text = "") {
  return text
    .replace(/^hey\s+(arvsal|arsal|arsel|arsenal|harshal)\s*/i, "")
    .trim();
}

// ================= CONFIDENCE DECAY =================
try { memory.decayConfidence(); } catch {}
setInterval(() => {
  try { memory.decayConfidence(); } catch {}
}, 6 * 60 * 60 * 1000);

// ================= COMMAND =================
app.post("/command", async (req, res) => {
  const rawInput =
    req.body.command ??
    req.body.text ??
    req.body.message ??
    "";

  if (!rawInput || typeof rawInput !== "string") {
    return res.json({ reply: "" });
  }

  const normalized = normalize(rawInput);
  const cleanRawText = stripWakeWord(normalized.rawText);
  const cleanNormalizedText = stripWakeWord(normalized.normalizedText);

  chatHistory.addMessage("user", cleanRawText);

  // ---------- INTENT (RULES FIRST) ----------
  let intentObj = classifyIntent({
    rawText: cleanRawText,
    normalizedText: cleanNormalizedText
  });

  // ---------- LLM INTENT FALLBACK ----------
  if (
    intentObj.intent === "GENERAL_QUESTION" &&
    cleanRawText.length > 3 &&
    !getConfirmation()
  ) {
    const llmIntent = await resolveIntentWithLLM(cleanRawText);
    if (llmIntent?.intent) intentObj = llmIntent;
  }

  // ---------- CONFIRMATION ----------
  const pending = getConfirmation();
  if (pending) {
    if (intentObj.intent === "CONFIRM_YES") {
      clearConfirmation();
      pending.execute?.();
      const reply = await applyPersonality("Okay, confirmed.");
      chatHistory.addMessage("arvsal", reply);
      return res.json({ reply });
    }

    if (intentObj.intent === "CONFIRM_NO") {
      clearConfirmation();
      const reply = await applyPersonality("Okay, cancelled.");
      chatHistory.addMessage("arvsal", reply);
      return res.json({ reply });
    }

    const reply = await applyPersonality("Please say yes or no.");
    chatHistory.addMessage("arvsal", reply);
    return res.json({ reply });
  }

  // ---------- MAIN FLOW ----------
  let reply = "";
  let skipEpisodic = false;

  try {
    switch (intentObj.intent) {

      // ===== DETERMINISTIC =====
      case "INTRODUCE_SELF":
      case "REMEMBER":
      case "RECALL":
      case "FORGET":
      case "MEMORY_SUMMARY":
      case "DAY_RECALL":
      case "EPISODIC_BY_DATE":
      case "EPISODIC_RECALL":
      case "SMALLTALK":
      case "LOCAL_SKILL":
        reply = await handleIntent(intentObj);
        break;

      // ===== APPS =====
      case "OPEN_APP":
        if (!intentObj.app) {
          reply = "Which app do you want me to open?";
          break;
        }
        openApp(intentObj.app);
        reply = `Opening ${intentObj.app}`;
        skipEpisodic = true;
        break;

      case "OPEN_FOLDER":
        if (!intentObj.path) {
          reply = "Which folder should I open?";
          break;
        }
        openFolder(intentObj.path);
        reply = "Opening folder";
        skipEpisodic = true;
        break;

      case "OPEN_CALENDAR":
        openCalendar();
        reply = "Opening calendar";
        skipEpisodic = true;
        break;

      // ===== SYSTEM =====
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
        reply = "System locked";
        skipEpisodic = true;
        break;

      // ===== MEDIA =====
      case "VOLUME_UP":
        volumeUp(); reply = "Volume increased"; skipEpisodic = true; break;
      case "VOLUME_DOWN":
        volumeDown(); reply = "Volume decreased"; skipEpisodic = true; break;
      case "MUTE":
        mute(); reply = "Volume muted"; skipEpisodic = true; break;

      // ===== WEB =====
      case "SEARCH":
        if (!intentObj.query) {
          reply = "What should I search for?";
          break;
        }
        searchGoogle(intentObj.query);
        reply = `Searching for ${intentObj.query}`;
        skipEpisodic = true;
        break;

      case "YOUTUBE":
        if (!intentObj.query) {
          reply = "What should I search on YouTube?";
          break;
        }
        openYouTube(intentObj.query);
        reply = `Searching YouTube for ${intentObj.query}`;
        skipEpisodic = true;
        break;

      // ===== GENERATIVE =====
      default:
        reply = await llmRouter({
          intent: intentObj.intent,
          text: cleanRawText
        });
        if (!reply) reply = "I'm not certain about that.";
    }

  } catch (err) {
    console.error(err);
    reply = "Something went wrong.";
  }

  reply = await applyPersonality(reply);
  chatHistory.addMessage("arvsal", reply);

  if (!skipEpisodic) {
    episodicMemory.store({
      type: "response",
      subject: "arvsal",
      value: reply,
      source: "system"
    });
  }

  try { if (shouldReflect()) reflect(); } catch {}

  res.json({ reply });
});

// ================= START =================
app.listen(3000, () => {
  console.log("Arvsal backend running on http://localhost:3000");
});

















// // ================= ENV =================
// require("dotenv").config();

// // ================= MEMORY =================
// const chatHistory = require("./chatHistory");
// const episodicMemory = require("./episodicMemory");
// const memory = require("./memory");

// // ================= CORE =================
// const express = require("express");
// const cors = require("cors");

// // ================= CONFIRMATION =================
// const {
//   setConfirmation,
//   getConfirmation,
//   clearConfirmation
// } = require("./confirmManager");

// // ================= BRAIN =================
// const normalize = require("./normalizer");
// const classifyIntent = require("./intentClassifier");
// const { resolveIntentWithLLM } = require("./llmIntentRouter");
// const { handleIntent } = require("./actions");
// const applyPersonality = require("./personality");
// const llmRouter = require("./llmRouter");

// // ================= MEMORY REFLECTION =================
// const { shouldReflect, reflect } = require("./reflect");

// // ================= SYSTEM ACTIONS =================
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
//   playPause,
//   nextTrack,
//   prevTrack,
//   searchGoogle,
//   openYouTube
// } = require("./systemActions");

// // ================= APP =================
// const app = express();
// app.use(cors());
// app.use(express.json());

// // ================= HELPERS =================
// function stripWakeWord(text = "") {
//   return text
//     .replace(/^hey\s+(arvsal|arsal|arsel|arsenal|harshal)\s*/i, "")
//     .trim();
// }

// // ================= 🧠 CONFIDENCE DECAY =================
// try {
//   memory.decayConfidence();
// } catch {}

// setInterval(() => {
//   try {
//     memory.decayConfidence();
//   } catch {}
// }, 6 * 60 * 60 * 1000);

// // ================= COMMAND =================
// app.post("/command", async (req, res) => {
//   const rawInput =
//     req.body.command ??
//     req.body.text ??
//     req.body.message ??
//     "";

//   if (!rawInput || typeof rawInput !== "string") {
//     return res.json({ reply: "" });
//   }

//   // 🔑 NORMALIZATION
//   const normalized = normalize(rawInput);
//   const cleanRawText = stripWakeWord(normalized.rawText);
//   const cleanNormalizedText = stripWakeWord(normalized.normalizedText);

//   // 🧠 CHAT HISTORY (USER)
//   chatHistory.addMessage("user", cleanRawText);

//   // ================= INTENT (DETERMINISTIC FIRST) =================
//   let intentObj = classifyIntent({
//     rawText: cleanRawText,
//     normalizedText: cleanNormalizedText
//   });

//   // ================= 🤖 LLM INTENT FALLBACK =================
//   if (
//     intentObj.intent === "GENERAL_QUESTION" &&
//     cleanRawText.length > 3
//   ) {
//     const llmIntent = await resolveIntentWithLLM(cleanRawText);
//     if (llmIntent?.intent) {
//       intentObj = llmIntent;
//     }
//   }

//   // ================= EPISODIC USER MEMORY =================
//   const NON_EPISODIC_INTENTS = new Set([
//     "REMEMBER",
//     "FORGET",
//     "RECALL",
//     "MEMORY_SUMMARY",
//     "DAY_RECALL",
//     "EPISODIC_BY_DATE",
//     "CONFIRM_YES",
//     "CONFIRM_NO",
//     "LOCAL_SKILL"
//   ]);

//   const isContextFollowup =
//     intentObj.intent === "RECALL" && intentObj.key === "it";

//   if (
//     !NON_EPISODIC_INTENTS.has(intentObj.intent) &&
//     !isContextFollowup &&
//     cleanRawText.length > 10
//   ) {
//     episodicMemory.store({
//       type: "conversation",
//       subject: "user",
//       value: cleanRawText,
//       source: "user"
//     });
//   }

//   // ================= CONFIRMATION FLOW =================
//   const pending = getConfirmation();

//   if (pending) {
//     if (intentObj.intent === "CONFIRM_YES") {
//       clearConfirmation();
//       pending.execute?.();
//       const reply = await applyPersonality("Okay, confirmed.");
//       chatHistory.addMessage("arvsal", reply);
//       return res.json({ reply });
//     }

//     if (intentObj.intent === "CONFIRM_NO") {
//       clearConfirmation();
//       const reply = await applyPersonality("Okay, cancelled.");
//       chatHistory.addMessage("arvsal", reply);
//       return res.json({ reply });
//     }

//     const reply = await applyPersonality("Please say yes or no.");
//     chatHistory.addMessage("arvsal", reply);
//     return res.json({ reply });
//   }

//   // ================= MAIN FLOW =================
//   let reply = "";
//   let skipEpisodicResponse = false;

//   try {
//     switch (intentObj.intent) {

//       // 🧠 CORE
//       case "INTRODUCE_SELF":
//       case "REMEMBER":
//       case "RECALL":
//       case "FORGET":
//       case "MEMORY_SUMMARY":
//       case "DAY_RECALL":
//       case "EPISODIC_BY_DATE":
//       case "EPISODIC_RECALL":
//       case "SMALLTALK":
//       case "LOCAL_SKILL":
//         reply = await handleIntent(intentObj);
//         break;

//       // -------- APPS --------
//       case "OPEN_APP":
//         openApp(intentObj.app);
//         reply = `Opening ${intentObj.app}`;
//         skipEpisodicResponse = true;
//         break;

//       case "OPEN_FOLDER":
//         openFolder(intentObj.path);
//         reply = "Opening folder";
//         skipEpisodicResponse = true;
//         break;

//       case "OPEN_CALENDAR":
//         openCalendar();
//         reply = "Opening calendar";
//         skipEpisodicResponse = true;
//         break;

//       // -------- SYSTEM --------
//       case "SHUTDOWN":
//         setConfirmation({ execute: shutdown });
//         reply = "Are you sure you want to shut down?";
//         skipEpisodicResponse = true;
//         break;

//       case "RESTART":
//         setConfirmation({ execute: restart });
//         reply = "Are you sure you want to restart?";
//         skipEpisodicResponse = true;
//         break;

//       case "SLEEP":
//         setConfirmation({ execute: sleep });
//         reply = "Do you want to put the system to sleep?";
//         skipEpisodicResponse = true;
//         break;

//       case "LOCK":
//         lock();
//         reply = "System locked";
//         skipEpisodicResponse = true;
//         break;

//       // -------- MEDIA --------
//       case "VOLUME_UP":
//         volumeUp();
//         reply = "Volume increased";
//         skipEpisodicResponse = true;
//         break;

//       case "VOLUME_DOWN":
//         volumeDown();
//         reply = "Volume decreased";
//         skipEpisodicResponse = true;
//         break;

//       case "MUTE":
//         mute();
//         reply = "Volume muted";
//         skipEpisodicResponse = true;
//         break;

//       // -------- WEB --------
//       case "SEARCH":
//         searchGoogle(intentObj.query);
//         reply = `Searching for ${intentObj.query}`;
//         skipEpisodicResponse = true;
//         break;

//       case "YOUTUBE":
//         openYouTube(intentObj.query);
//         reply = `Searching YouTube for ${intentObj.query}`;
//         skipEpisodicResponse = true;
//         break;

//       // 🤖 FINAL RESPONSE LLM ONLY
//       default:
//         reply = await llmRouter({
//           intent: intentObj.intent,
//           text: cleanRawText
//         });
//     }
//   } catch (err) {
//     console.error("ERROR:", err);
//     reply = "Something went wrong.";
//   }

//   reply = await applyPersonality(reply);

//   // 🧠 CHAT HISTORY (ARVSAL)
//   chatHistory.addMessage("arvsal", reply);

//   // 🧠 EPISODIC RESPONSE
//   if (!skipEpisodicResponse) {
//     episodicMemory.store({
//       type: "response",
//       subject: "arvsal",
//       value: reply,
//       source: "system"
//     });
//   }

//   // 🧠 REFLECTION
//   try {
//     if (shouldReflect()) reflect();
//   } catch {}

//   res.json({ reply });
// });

// // ================= HISTORY =================
// app.get("/history", (req, res) => {
//   res.json(chatHistory.getHistory());
// });

// // ================= START =================
// app.listen(3000, () => {
//   console.log("Arvsal backend running on http://localhost:3000");
// });






