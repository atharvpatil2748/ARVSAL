const { spawn } = require("child_process");
const path = require("path");
const { isOnBattery } = require("./utils/powerMonitor");

const WHISPER_EXE = path.resolve(
    __dirname,
    "../whisper.cpp/build/bin/whisper-cli.exe"
);

function runFinalWhisper(wavPath, modelPath, extraArgs = []) {
    return new Promise((resolve, reject) => {

        let output = "";

        console.log("🚀 Whisper FINAL START");

        const useGPU = !isOnBattery();

        const args = [
            "-m", modelPath,
            "-f", wavPath,
            "--language", "auto",
            "--translate",
            "--threads", "6",
            "--no-timestamps",
            ...extraArgs
        ];

        if (!useGPU) {
            console.log("⚡ Battery mode → using CPU for Whisper");
            args.push("--no-gpu");
        } else {
            console.log("🚀 Plugged in → using GPU for Whisper");
        }

        console.log("Whisper Mode:", useGPU ? "GPU" : "CPU");

        const proc = spawn(WHISPER_EXE, args);

        proc.stdout.on("data", d => { output += d.toString(); });

        proc.stderr.on("data", d => {
            const msg = d.toString().trim();
            if (msg) console.log("[Whisper stderr]", msg);
        });

        proc.on("close", () => {
            const text = output
                .split("\n")
                .map(l => l.replace(/^.*\]\s*/, ""))
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            console.log("✅ Whisper FINAL END:", text || "(empty)");
            resolve(text || "");
        });

        proc.on("error", reject);
    });
}

module.exports = { runFinalWhisper };
