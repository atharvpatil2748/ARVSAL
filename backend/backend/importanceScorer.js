/**
 * Importance Scorer
 *
 * Determines how important an episodic memory is.
 *
 * MUST:
 * - Never throw
 * - Never assume strings
 * - Always return a number between 0 and 1
 * - Be deterministic
 */

function normalize(v) {
  if (typeof v !== "string") return "";
  return v.toLowerCase();
}

function scoreImportance({
  type,
  subject,
  key,
  value,
  source
} = {}) {
  try {
    const t = normalize(type);
    const s = normalize(subject);
    const k = normalize(key);
    const v = normalize(value);

    /* ================= HARD RULES ================= */

    // Explicit memory is always critical
    if (t === "explicit_memory") return 1.0;

    // Forget actions are important
    if (t === "forget") return 0.8;

    /* ================= BASELINE ================= */

    let score = 0.4;

    /* ================= KEY-BASED SIGNALS ================= */

    if (k.length > 0) {
      if (
        k.includes("name") ||
        k.includes("identity") ||
        k.includes("relationship")
      ) {
        score += 0.3;
      }
    }

    /* ================= CONTENT SIGNALS ================= */

    if (v.length > 0) {
      // Emotional / personal topics
      if (/love|emotion|feel|family|friend|relationship|health/i.test(v)) {
        score += 0.2;
      }

      // Natural-language length (not junk)
      if (v.length > 40 && /\s/.test(v)) {
        score += 0.1;
      }
    }

    /* ================= SUBJECT SIGNALS ================= */

    // Non-user subjects are usually notable
    if (s && s !== "user" && s !== "arvsal") {
      score += 0.1;
    }

    /* ================= SYSTEM PENALTY ================= */

    // System responses should not dominate memory
    if (t === "response" || source === "system") {
      score -= 0.15;
    }

    /* ================= CLAMP ================= */

    if (score > 1) score = 1;
    if (score < 0) score = 0;

    return score;
  } catch {
    // 🔒 ABSOLUTE FAIL-SAFE
    return 0.4;
  }
}

module.exports = {
  scoreImportance
};