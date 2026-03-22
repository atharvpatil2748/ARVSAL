/**
 * Screen Capture – Desktop Monitor Capture
 *
 * PURPOSE:
 * - Captures the user's actual screen display (NOT webcam/camera)
 * - Offline, no external dependencies beyond screenshot-desktop
 * - Auto-cleanup after configurable TTL
 * - Never throws (returns null on failure)
 */

const screenshot = require("screenshot-desktop");
const fs = require("fs");
const path = require("path");
const os = require("os");

/* ================= CONFIG ================= */

const CLEANUP_TTL_MS = 60 * 1000; // 60 seconds
const TEMP_DIR = os.tmpdir();

/* ================= LOGGER ================= */

function log(...args) {
    console.log("[ScreenCapture]", ...args);
}

/* ================= CLEANUP ================= */

function scheduleCleanup(filePath, ttlMs = CLEANUP_TTL_MS) {
    setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                log("Cleaned up:", filePath);
            }
        } catch {
            // cleanup must never crash
        }
    }, ttlMs);
}

/* ================= MAIN ================= */

/**
 * Captures the desktop screen as a PNG file.
 *
 * @returns {{ imagePath: string, timestamp: number } | null}
 */

async function captureScreen() {
    const timestamp = Date.now();
    const fileName = `arvsal_screen_${timestamp}.png`;
    const imagePath = path.join(TEMP_DIR, fileName);

    try {

        // ⭐ capture buffer instead of direct file
        const img = await screenshot({ format: "png" });

        if (!img) {
            log("Capture failed: empty buffer");
            return null;
        }

        // ⭐ write file manually
        fs.writeFileSync(imagePath, img);

        const stats = fs.statSync(imagePath);

        if (stats.size === 0) {
            log("Capture failed: empty file");
            return null;
        }

        /* ⭐ REAL SIZE (stable) */
        const width = img.readUInt32BE(16);
        const height = img.readUInt32BE(20);

        log(
            "Screen captured:",
            imagePath,
            `(${Math.round(stats.size / 1024)}KB)`,
            `${width}x${height}`
        );

        scheduleCleanup(imagePath);

        return {
            imagePath,
            timestamp,
            width,
            height
        };

    } catch (err) {
        log("Capture error:", err?.message || err);
        return null;
    }
}

/**
 * Manually delete a captured screen image before TTL.
 */
function cleanupCapture(imagePath) {
    try {
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    } catch {
        // silent
    }
}

/* ================= EXPORT ================= */

module.exports = {
    captureScreen,
    cleanupCapture
};
