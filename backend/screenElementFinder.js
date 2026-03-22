/**
 * Screen Element Finder
 *
 * PURPOSE:
 * - Find UI element coordinates from a screenshot
 * - Offline (LLaVA): default when local AI is active
 * - Online (Gemini Flash): when user has connected Gemini
 * - OCR fallback: pure text-position heuristic (no vision model needed)
 *
 * OUTPUT: { found, x, y, label, method }
 */

const fs = require("fs");
const { getActiveAI } = require("./aiSwitch");

/* ================= CONFIG ================= */

const LLAVA_MODEL = "llava";
const LLAVA_TIMEOUT = 30000; // 30s — LLaVA is slower than Gemini

/* ================= LOGGER ================= */

function log(...args) {
    console.log("[ScreenElementFinder]", ...args);
}

/* ================= JSON EXTRACTOR ================= */

function extractJSON(text) {
    if (!text) return null;
    try {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
}

/* ================= OFFLINE: LLaVA ================= */

async function findWithLLaVA(imagePath, description) {
    const { runVision } = require("./visionRunner");

    const prompt =
        `You are a screen UI element locator. Look at this screenshot carefully.\n` +
        `Find the UI element matching: "${description}".\n` +
        `Return ONLY valid JSON with pixel coordinates. No explanation.\n` +
        `If found: {"found":true,"x":<number>,"y":<number>,"label":"<text near element>"}\n` +
        `If not found: {"found":false}\n` +
        `IMPORTANT: x and y must be integers representing screen pixel coordinates.`;

    try {
        const raw = await runVision({
            model: LLAVA_MODEL,
            imagePath,
            prompt,
            timeout: LLAVA_TIMEOUT
        });

        const parsed = extractJSON(raw);

        if (!parsed) {
            log("LLaVA returned unparseable output:", raw?.slice(0, 100));
            return null;
        }

        if (parsed.found === false) {
            return { found: false, method: "llava" };
        }

        if (
            parsed.found === true &&
            typeof parsed.x === "number" &&
            typeof parsed.y === "number"
        ) {
            log(`LLaVA found "${description}" at (${parsed.x}, ${parsed.y})`);
            return {
                found: true,
                x: Math.round(parsed.x),
                y: Math.round(parsed.y),
                label: parsed.label || description,
                method: "llava"
            };
        }

        return null;
    } catch (err) {
        log("LLaVA error:", err?.message);
        return null;
    }
}

/* ================= ONLINE: Gemini Flash ================= */

async function findWithGemini(imagePath, description) {
    const { askGeminiVision } = require("./geminiClient");

    const prompt =
        `You are a screen UI element locator. Look at this screenshot carefully.\n` +
        `Find the UI element matching: "${description}".\n` +
        `Return ONLY valid JSON. No markdown, no explanation.\n` +
        `If found: {"found":true,"x":<integer>,"y":<integer>,"label":"<visible text near element>"}\n` +
        `If not found: {"found":false}`;

    try {
        const raw = await askGeminiVision({ imagePath, prompt });
        const parsed = extractJSON(raw);

        if (!parsed) {
            log("Gemini returned unparseable output:", raw?.slice(0, 100));
            return null;
        }

        if (parsed.found === false) {
            return { found: false, method: "gemini" };
        }

        if (
            parsed.found === true &&
            typeof parsed.x === "number" &&
            typeof parsed.y === "number"
        ) {
            log(`Gemini found "${description}" at (${parsed.x}, ${parsed.y})`);
            return {
                found: true,
                x: Math.round(parsed.x),
                y: Math.round(parsed.y),
                label: parsed.label || description,
                method: "gemini"
            };
        }

        return null;
    } catch (err) {
        log("Gemini error:", err?.message);
        return null;
    }
}

/* ================= FALLBACK: OCR Heuristic ================= */

/**
 * Pure text-based heuristic when no vision model is available.
 * Searches OCR output for the element label and estimates center coords.
 * NOTE: Very approximate — only reliable for text-labeled elements.
 */
function findWithOCRHeuristic(ocrText, description) {
    if (!ocrText || !description) return null;

    const lower = ocrText.toLowerCase();
    const target = description.toLowerCase()
        .replace(/\b(the|a|an|button|link|field|box|input|icon)\b/g, "")
        .trim();

    if (!target || !lower.includes(target)) {
        return { found: false, method: "ocr_heuristic" };
    }

    log(`OCR heuristic found "${target}" in text`);

    // Estimate: we can't get exact coords from raw OCR text without bounding boxes.
    // Return found=true but no coords — orchestrator will warn user.
    return {
        found: true,
        x: null,
        y: null,
        label: target,
        method: "ocr_heuristic",
        note: "Approximate — coordinates unavailable from OCR alone"
    };
}

/* ================= MAIN ================= */

/**
 * Find a UI element on screen given a screenshot path and description.
 *
 * @param {string} imagePath - Path to screenshot PNG
 * @param {string} description - Natural language description of element
 * @param {string} [ocrText] - OCR text from screen (for fallback)
 * @returns {Promise<{found: boolean, x?: number, y?: number, label?: string, method?: string}>}
 */
async function findElement(imagePath, description, ocrText = "") {

    if (!imagePath || !fs.existsSync(imagePath)) {
        log("Image not found:", imagePath);
        return { found: false, method: "none", reason: "screenshot_missing" };
    }

    if (!description || typeof description !== "string") {
        return { found: false, method: "none", reason: "no_description" };
    }

    const activeAI = getActiveAI();
    log(`Finding "${description}" — AI mode: ${activeAI}`);

    // Strategy 1: Gemini (online, fast, precise)
    if (activeAI === "gemini") {
        const geminiResult = await findWithGemini(imagePath, description);
        if (geminiResult) return geminiResult;
        // Fall through to LLaVA if Gemini fails
        log("Gemini failed — falling back to LLaVA");
    }

    // Strategy 2: LLaVA (offline, slower, still good)
    const llavaResult = await findWithLLaVA(imagePath, description);
    if (llavaResult) return llavaResult;

    // Strategy 3: OCR heuristic (pure text, no coords)
    log("Vision models failed — using OCR heuristic");
    return findWithOCRHeuristic(ocrText, description);
}

/* ================= EXPORT ================= */

module.exports = {
    findElement
};
