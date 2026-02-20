/**
 * External AI Gateway (Groq) - FINAL VERSION
 * - Pure transport: Respects prompts from llmRouter
 * - Cooldown-aware: Prevents "Retry Storms"
 * - Clean error propagation
 * - Native Fetch (Node 18+)
 */

require("dotenv").config();

/* ================= CONFIG ================= */

const MODEL_NAME = "llama-3.1-8b-instant";
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT = 15000; // 15 seconds

/* ================= STATE ================= */

let lastFailureAt = 0;

/* ================= ERRORS ================= */

class GroqUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "GroqUnavailableError";
  }
}

/* ================= MAIN ================= */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function askGroq(fullPrompt) {
  // ⛔ Initialization check
  if (!GROQ_API_KEY) {
    console.error("[GROQ] API Key missing. Check .env");
    throw new GroqUnavailableError("Groq API key not set");
  }

  // ⛔ Cooldown guard
  if (Date.now() - lastFailureAt < COOLDOWN_MS) {
    throw new GroqUnavailableError("Groq cooldown active");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    // 🔥 Using global fetch (Standard in Node 18+)
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          temperature: 0.6,
          messages: [
            {
              role: "user",
              content: fullPrompt
            }
          ]
        })
      }
    );

    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        lastFailureAt = Date.now();
      }
      throw new Error(`Groq Status ${response.status}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) throw new Error("Empty response from Groq");

    return reply.trim();

  } catch (err) {
    clearTimeout(timer);
    
    lastFailureAt = Date.now();

    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("aborted") || msg.includes("timeout")) {
      throw new GroqUnavailableError("Groq timeout");
    }

    throw new GroqUnavailableError(err.message || "Groq service error");
  }
}

module.exports = { askGroq, GroqUnavailableError };