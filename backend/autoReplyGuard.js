const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

let lastAutoReply = {};

function canAutoReply(number) {
  const now = Date.now();

  if (!lastAutoReply[number]) {
    lastAutoReply[number] = now;
    return true;
  }

  const diff = now - lastAutoReply[number];

  if (diff > COOLDOWN_MS) {
    lastAutoReply[number] = now;
    return true;
  }

  return false;
}

function resetCooldown() {
  lastAutoReply = {};
}

module.exports = {
  canAutoReply,
  resetCooldown
};