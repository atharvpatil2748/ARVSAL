const { spawn } = require("child_process");

const MODELS = [
  "phi3:mini",
  "llama3"
];

function warm(model) {
  return new Promise(resolve => {
    const p = spawn("ollama", ["run", model, "Say hello"], {
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true
    });

    setTimeout(() => {
      try { p.kill("SIGKILL"); } catch {}
      resolve();
    }, 3000); // enough to load model
  });
}

async function warmAll() {
  console.log("[OLLAMA] Warming models...");
  for (const m of MODELS) {
    console.log("[OLLAMA] Warm:", m);
    await warm(m);
  }
  console.log("[OLLAMA] Warmup complete");
}

module.exports = { warmAll };