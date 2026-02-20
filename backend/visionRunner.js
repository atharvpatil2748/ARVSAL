// backend/visionRunner.js

const { spawn } = require("child_process");
const fs = require("fs");

async function runVision({ model = "llava", imagePath, prompt, timeout = 60000 }) {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(imagePath)) {
      return reject(new Error("Image file not found"));
    }

    const proc = spawn("ollama", ["run", model, prompt]);

    let output = "";
    let error = "";

    proc.stdout.on("data", d => {
      output += d.toString();
    });

    proc.stderr.on("data", d => {
      error += d.toString();
    });

    proc.on("close", code => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(error || "Vision model failed"));
      }
    });

    // Pipe image file into stdin
    const imageStream = fs.createReadStream(imagePath);
    imageStream.pipe(proc.stdin);

    setTimeout(() => {
      proc.kill();
      reject(new Error("Vision timeout"));
    }, timeout);

  });
}

module.exports = { runVision };