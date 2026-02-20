const { exec } = require("child_process");

// Full path to eSpeak
const ESPEAK =
  `"C:\\Program Files (x86)\\eSpeak\\command_line\\espeak.exe"`;

// Tuned voice settings (less robotic)
const VOICE = "en-us";
const SPEED = 135;   // slower = smoother
const PITCH = 32;    // lower = calmer
const VOLUME = 110;  // softer

function speak(text) {
  if (!text || typeof text !== "string") return;

  const safeText = text.replace(/"/g, "");

  exec(
    `${ESPEAK} -v ${VOICE} -s ${SPEED} -p ${PITCH} -a ${VOLUME} "${safeText}"`,
    { windowsHide: true },
    (err) => {
      if (err) console.error("eSpeak error:", err.message);
    }
  );
}

module.exports = speak;






