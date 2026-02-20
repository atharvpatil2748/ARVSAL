/**
 * Arvsal Visual Module (A-Eye)
 * Optimized for Integrated Hardware bypass
 * Logic: Uses FFmpeg to bypass virtual drivers and captures after a warm-up buffer.
 */

const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { sendTelegramDocument } = require("./telegramService");

/**
 * Snaps a photo using FFmpeg for direct hardware access
 * Includes a 5-second warm-up delay to prevent black/dark frames.
 */
async function takeAeyeSnap() {
    // Generate a temporary path for the image
    const savedPath = path.join(os.tmpdir(), `arvsal_aeye_${Date.now()}.jpg`);
    
    /**
     * FFmpeg Command Breakdown:
     * -f dshow: DirectShow interface for Windows hardware.
     * -i video="Integrated Camera": Targets the physical hardware directly.
     * -ss 00:00:05: Skips the first 5 seconds of the stream (Warm-up/Calibration).
     * -frames:v 1: Captures exactly one high-quality frame after the skip.
     * -y: Overwrite file if it exists.
     */
    const ffmpegCmd = `ffmpeg -f dshow -i video="Integrated Camera" -ss 00:00:05 -frames:v 1 -y "${savedPath}"`;

    return new Promise((resolve, reject) => {
        // Execute the hardware capture
        exec(ffmpegCmd, async (err) => {
            if (err) {
                console.error("FFmpeg Capture Error:", err);
                return reject("Hardware conflict: Ensure no other app is using the camera.");
            }

            try {
                // Verify the file was created before attempting to send
                if (fs.existsSync(savedPath)) {
                    // Transmit to your secure Telegram channel
                    await sendTelegramDocument(savedPath);
                    
                    // Security Cleanup: Delete the local image after 2 seconds
                    setTimeout(() => {
                        if (fs.existsSync(savedPath)) {
                            fs.unlinkSync(savedPath);
                        }
                    }, 2000);

                    resolve("Visual data transmitted, sir.");
                } else {
                    reject("Capture failed: Image file not found.");
                }
            } catch (sendErr) {
                console.error("Telegram Transmission Error:", sendErr);
                reject("Image captured but transmission to Telegram failed.");
            }
        });
    });
}

module.exports = { takeAeyeSnap };


