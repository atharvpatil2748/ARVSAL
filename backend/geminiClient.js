/**
 * Gemini Client (SAFE + COOLDOWN AWARE)
 *
 * - Hard cooldown on failure
 * - No retry storms
 * - Deterministic errors
 * - Router-safe
 * - Vision support (askGeminiVision)
 */

require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

/* ================= CONFIG ================= */

const MODEL_NAME = "gemini-2.5-flash";
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/* ================= STATE ================= */

let model = null;
let lastFailureAt = 0;

/* ================= ERRORS ================= */

class GeminiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

/* ================= INIT ================= */

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("[GEMINI] GEMINI_API_KEY not set — Gemini disabled");
} else {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL_NAME });
    console.log("[GEMINI] Gemini model initialized");
  } catch (e) {
    console.error("[GEMINI INIT ERROR]", e.message);
    model = null;
  }
}

/* ================= MAIN ================= */

async function askGemini(prompt) {
  if (!model) {
    throw new GeminiUnavailableError("Gemini not initialized");
  }

  // ⛔ Cooldown guard
  if (Date.now() - lastFailureAt < COOLDOWN_MS) {
    throw new GeminiUnavailableError("Gemini cooldown active");
  }

  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();

    if (!text || typeof text !== "string") {
      throw new Error("Empty Gemini response");
    }

    return text.trim();

  } catch (err) {
    lastFailureAt = Date.now();

    const msg = String(err?.message || "").toLowerCase();

    // Overload / quota / rate limits
    if (
      err?.status === 429 ||
      err?.status === 503 ||
      msg.includes("quota") ||
      msg.includes("rate") ||
      msg.includes("overload")
    ) {
      throw new GeminiUnavailableError("Gemini rate-limited or overloaded");
    }

    // Network / transport
    if (
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("timeout")
    ) {
      throw new GeminiUnavailableError("Gemini network error");
    }

    throw new GeminiUnavailableError("Gemini unavailable");
  }
}

/* ================= VISION ================= */

/**
 * Ask Gemini with an image attached (for screen element finding, screen analysis).
 *
 * @param {{ imagePath: string, prompt: string }} opts
 * @returns {Promise<string>}
 */
async function askGeminiVision({ imagePath, prompt }) {
  if (!model) {
    throw new GeminiUnavailableError("Gemini not initialized");
  }

  if (Date.now() - lastFailureAt < COOLDOWN_MS) {
    throw new GeminiUnavailableError("Gemini cooldown active");
  }

  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error("[GeminiVision] Image file not found: " + imagePath);
  }

  try {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString("base64");

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/png"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result?.response?.text?.();

    if (!text || typeof text !== "string") {
      throw new Error("Empty Gemini Vision response");
    }

    return text.trim();

  } catch (err) {
    lastFailureAt = Date.now();
    const msg = String(err?.message || "").toLowerCase();

    if (
      err?.status === 429 ||
      err?.status === 503 ||
      msg.includes("quota") ||
      msg.includes("rate") ||
      msg.includes("overload")
    ) {
      throw new GeminiUnavailableError("Gemini Vision rate-limited or overloaded");
    }

    if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
      throw new GeminiUnavailableError("Gemini Vision network error");
    }

    throw new GeminiUnavailableError("Gemini Vision unavailable: " + err?.message);
  }
}

/* ================= EXPORT ================= */

module.exports = {
  askGemini,
  askGeminiVision,
  GeminiUnavailableError
};