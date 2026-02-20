const { exec } = require("child_process");

function speakFast(text) {
  if (!text) return;

  const safe = text.replace(/"/g, "");

  exec(
    `espeak -v en-us -s 145 -p 40 -a 120 "${safe}"`,
    { windowsHide: true }
  );
}

module.exports = speakFast;
