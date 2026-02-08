const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PIPER_DIR = "C:\\Users\\athar\\Downloads\\piper_windows_amd64\\piper";
const PIPER_EXE = path.join(PIPER_DIR, "piper.exe");
const MODEL = path.join(PIPER_DIR, "en_US-ryan-high.onnx");

// temp wav file
const WAV_FILE = path.join(PIPER_DIR, "arvsal.wav");

let busy = false;

function speak(text) {
  if (!text || busy) return;
  busy = true;

  // Remove old wav
  if (fs.existsSync(WAV_FILE)) {
    fs.unlinkSync(WAV_FILE);
  }

  const piper = spawn(
    PIPER_EXE,
    ["-m", MODEL, "-f", WAV_FILE, "--quiet"],
    { cwd: PIPER_DIR }
  );

  piper.stdin.write(text);
  piper.stdin.end();

  piper.on("close", () => {
    spawn("powershell", [
      "-c",
      `(New-Object System.Media.SoundPlayer '${WAV_FILE}').PlaySync()`
    ]).on("exit", () => {
      busy = false;
    });
  });
}

module.exports = speak;

