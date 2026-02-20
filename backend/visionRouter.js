// backend/visionRouter.js

const { runVision } = require("./visionRunner");
const { getActiveAI } = require("./aiSwitch");

// You will later extend this with Gemini vision
// const { askGeminiVision } = require("./geminiClient");

async function visionRouter({ imagePath, prompt }) {

  const activeAI = getActiveAI();

  if (activeAI === "gemini") {
    // Placeholder for now
    throw new Error("Gemini vision not yet wired.");
  }

  // Default: Local
  return await runVision({
    model: "llava",
    imagePath,
    prompt
  });
}

module.exports = visionRouter;