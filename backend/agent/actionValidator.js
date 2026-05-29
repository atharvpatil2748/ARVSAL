/**
 * Action Validator — Phase 4 (Jarvis Safety Layer)
 *
 * Planner NEVER executes directly.
 * Validator decides.
 */

const uiState = require("./uiStateStore");

/* ================= CONFIG ================= */

const CONFIDENCE_THRESHOLD = 0.55;

/* ================= CONFIDENCE ================= */

function computeConfidence(resolution) {
    if (!resolution) return 0;

    const m = resolution.method || "";

    if (m === "memory") return 0.9;
    if (m === "ocr") return 0.65;
    if (m === "vision") return 0.6;

    // ⭐ CRITICAL — python vision methods
    if (m.startsWith("python")) return 0.7;

    // bbox present → strong signal
    if (resolution.bbox) return 0.65;

    return 0.4;
}

/* ================= RISK CHECK ================= */

function isDangerous(step) {
    const { tool, action } = step;

    if (tool === "system") return true;
    if (action === "shutdown") return true;
    if (action === "delete") return true;

    return false;
}

/* ================= VALIDATE STEP ================= */

function validateStep({
    step,
    resolution
}) {
    /* ===== dangerous actions ===== */

    if (isDangerous(step)) {
        return {
            allowed: false,
            reason: "dangerous_action",
            needsConfirmation: true,
            message: "This action is sensitive. Please confirm."
        };
    }

    /* ===== click validation ===== */

    if (step.tool === "desktop" && step.action === "click") {

        const hasCoords =
            typeof step.params?.x === "number" &&
            typeof step.params?.y === "number";

        const hasTarget =
            step.params?.target ||
            step.params?.label ||
            step.params?.element;

        // ⭐ allow planner target clicks (resolver will handle)
        if (hasTarget && !resolution) {
            return { allowed: true, confidence: 0.8 };
        }

        // ⭐ allow coordinate clicks
        if (hasCoords) {
            return { allowed: true, confidence: 1 };
        }

        // ⭐ if resolution exists → confidence check
        if (resolution && resolution.found) {

            const confidence = computeConfidence(resolution);

            if (confidence < CONFIDENCE_THRESHOLD) {
                return {
                    allowed: false,
                    reason: "low_confidence",
                    message: "I'm not confident enough to click that element."
                };
            }

            return { allowed: true, confidence };
        }

        return {
            allowed: false,
            reason: "missing_target",
            message: "Click requires a target."
        };
    }

    /* ===== type validation ===== */

    if (step.tool === "desktop" && step.action === "type") {
        if (!step.params?.text) {
            return {
                allowed: false,
                reason: "missing_text",
                message: "No text provided to type."
            };
        }

        return { allowed: true, confidence: 1 };
    }

    return { allowed: true };
}

module.exports = { validateStep };