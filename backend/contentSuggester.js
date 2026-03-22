/**
 * Content Suggester
 *
 * PURPOSE:
 * - Generate context-aware content suggestions from screen content
 * - Uses local llama3 (offline default) or Gemini (when connected)
 * - Covers: WhatsApp replies, search queries, code help, email responses
 * - Never auto-types — always waits for user confirmation (1 / 2 / 3 / none)
 */

const { runLLM } = require("./llmRunner");
const { askGemini } = require("./geminiClient");
const { getActiveAI } = require("./aiSwitch");

/* ================= CONFIG ================= */

const LOCAL_MODEL = "llama3";
const LOCAL_TIMEOUT = 30000;
const MAX_SUGGESTIONS = 3;

/* ================= LOGGER ================= */

function log(...args) {
    console.log("[ContentSuggester]", ...args);
}

/* ================= PROMPT BUILDER ================= */

function buildSuggestionPrompt(screenType, screenText, userInstruction) {
    const context = screenText
        ? `\n[SCREEN CONTENT]\n${screenText.slice(0, 800)}\n`
        : "";

    const typeHint = {
        whatsapp: "You are helping compose a WhatsApp message reply. Be casual, natural, short.",
        browser: "You are helping write a web search query or form input. Be concise and relevant.",
        coding: "You are helping write a code comment, commit message, or code review note. Be technical and precise.",
        pdf: "You are helping write an annotation or summary note about the document content.",
        terminal: "You are helping write a shell command or terminal input relevant to the visible context.",
        unknown: "You are helping write content for a text input field. Match the context and tone."
    }[screenType] || "You are helping write content for a text input field.";

    return `${typeHint}

${context}
User instruction: "${userInstruction}"

Generate exactly ${MAX_SUGGESTIONS} short, distinct suggestions (one per line, numbered 1. 2. 3.).
Each suggestion must be ready to type directly, no explanations, no quotes around them.
Match the tone and context of the screen content.`;
}

/* ================= RESPONSE PARSER ================= */

function parseSuggestions(raw) {
    if (!raw || typeof raw !== "string") return [];

    const lines = raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => /^[1-3][.)]\s+.+/.test(l))
        .map(l => l.replace(/^[1-3][.)]\s+/, "").trim())
        .filter(l => l.length > 0);

    return lines.slice(0, MAX_SUGGESTIONS);
}

/* ================= MAIN ================= */

/**
 * Generate content suggestions based on screen content and user instruction.
 *
 * @param {object} opts
 * @param {string} opts.screenText     - OCR text from screen
 * @param {string} opts.screenType     - "whatsapp" | "browser" | "coding" | "pdf" | "terminal" | "unknown"
 * @param {string} opts.userInstruction - What user asked to suggest
 * @returns {Promise<{ suggestions: string[], response: string }>}
 */
async function suggestContent({ screenText, screenType, userInstruction }) {

    const prompt = buildSuggestionPrompt(screenType, screenText, userInstruction);
    const activeAI = getActiveAI();

    log(`Generating suggestions — AI: ${activeAI}, screen: ${screenType}`);

    let raw = null;

    /* ===== ONLINE: Gemini ===== */
    if (activeAI === "gemini") {
        try {
            raw = await askGemini(prompt);
        } catch (err) {
            log("Gemini failed, falling back to local:", err?.message);
        }
    }

    /* ===== OFFLINE: local llama3 (default + fallback) ===== */
    if (!raw) {
        try {
            raw = await runLLM({ model: LOCAL_MODEL, prompt, timeout: LOCAL_TIMEOUT });
        } catch (err) {
            log("Local LLM failed:", err?.message);
        }
    }

    const suggestions = parseSuggestions(raw);

    if (!suggestions.length) {
        return {
            suggestions: [],
            response: "Sorry, I couldn't generate suggestions right now. Try rephrasing or check if Ollama is running."
        };
    }

    /* ===== Format user-facing response ===== */
    const lines = suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n");

    const response =
        `Here are ${suggestions.length} suggestions:\n\n${lines}\n\n` +
        `Reply with **1**, **2**, or **3** to type it — or **none** to cancel.`;

    return { suggestions, response };
}

/* ================= EXPORT ================= */

module.exports = {
    suggestContent
};
