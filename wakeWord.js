let active = false;
let lastWake = 0;

const WAKE_TIMEOUT = 10000;

// Acceptable wake variants (phonetic tolerance)
const WAKE_PATTERNS = [
  "hey arvsal",
  "hey arsal",
  "hey arsel",
  "hey arv sal",
  "hey arvs all",
  "hey arsenal",
  "hey our sal",
  "hey aar sal",
  "hey arsal please",
  "hey arvsal please",
  "hey aircel"
];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkWake(rawText) {
  const now = Date.now();
  const text = normalize(rawText);

  // Check wake patterns
  for (const pattern of WAKE_PATTERNS) {
    if (text.includes(pattern)) {
      active = true;
      lastWake = now;
      return true;
    }
  }

  // Auto sleep
  if (active && now - lastWake < WAKE_TIMEOUT) {
    return true;
  }

  active = false;
  return false;
}

module.exports = checkWake;

