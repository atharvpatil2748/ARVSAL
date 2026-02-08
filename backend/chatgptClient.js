/**
 * ChatGPT Client (SAFE + RATE-LIMIT AWARE)
 *
 * - Hard cooldown on failure
 * - No retry storms
 * - Deterministic errors
 * - Router-safe
 */

const OpenAI = require("openai");

/* ================= CONFIG ================= */

const MODEL = "gpt-4o-mini";
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/* ================= CLIENT ================= */

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/* ================= STATE ================= */

let lastFailureAt = 0;

/* ================= ERRORS ================= */

class ChatGPTUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChatGPTUnavailableError";
  }
}

/* ================= MAIN ================= */

async function askChatGPT(prompt) {
  if (!client) {
    throw new ChatGPTUnavailableError("OPENAI_API_KEY missing");
  }

  // ⛔ Cooldown guard
  if (Date.now() - lastFailureAt < COOLDOWN_MS) {
    throw new ChatGPTUnavailableError("ChatGPT cooldown active");
  }

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are Arvsal, a calm, precise, and helpful assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    const text = res?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      throw new Error("Empty ChatGPT response");
    }

    return text.trim();

  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();

    // ⛔ Mark failure time
    lastFailureAt = Date.now();

    // Rate limit / quota / overload
    if (
      err?.status === 429 ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests")
    ) {
      throw new ChatGPTUnavailableError("ChatGPT rate-limited");
    }

    // Network / OpenAI outage
    if (
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("timeout")
    ) {
      throw new ChatGPTUnavailableError("ChatGPT network error");
    }

    // Unknown → still block temporarily
    throw new ChatGPTUnavailableError("ChatGPT unavailable");
  }
}

/* ================= EXPORT ================= */

module.exports = {
  askChatGPT,
  ChatGPTUnavailableError
};