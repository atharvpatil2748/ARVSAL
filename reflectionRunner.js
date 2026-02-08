/**
 * Reflection Runner
 *
 * - Async
 * - Fail-safe
 * - No replies
 * - No side effects on main flow
 *
 * Phase 3 COMPLETE (HARDENED)
 */

const { shouldTriggerReflection } = require("./reflectionTrigger");
const { generateReflection } = require("./reflectionGenerator");
const reflectionMemory = require("./reflectionMemory");


/* ================= COOLDOWN ================= */

// Prevent reflection spam per subject
const REFLECTION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const lastRun = new Map();


function canRun(subject) {
  const now = Date.now();
  const last = lastRun.get(subject);
  if (last && now - last < REFLECTION_COOLDOWN_MS) {
    return false;
  }
  lastRun.set(subject, now);
  return true;
}


/* ================= SAFE GUARDS ================= */

function isValidSignal(signal) {
  return (
    signal &&
    typeof signal === "object" &&
    typeof signal.subject === "string" &&
    Array.isArray(signal.sampleEvents) &&
    signal.sampleEvents.length >= 2
  );
}


/* ================= MAIN ================= */

/**
 * Decide + generate + store reflection
 * @param {string} subject
 */
async function maybeRunReflection(subject = "user") {
  try {
    if (!canRun(subject)) return;

    const signal = shouldTriggerReflection(subject);
    if (!isValidSignal(signal)) return;

    const reflection = await generateReflection(signal);
    if (!reflection || typeof reflection.summary !== "string") return;

    // Store primary insight (backward compatible)
    reflectionMemory.addReflection({
      subject: reflection.subject || subject,
      insight: reflection.summary,
      confidence: reflection.confidence,
      relatedKeys: signal.dominantKeys || [],
      source: "reflection-engine"
    });

    // 🔒 Optional: store individual insights as weaker reflections
    if (Array.isArray(reflection.insights)) {
      for (const insight of reflection.insights) {
        if (typeof insight === "string" && insight.length > 10) {
          reflectionMemory.addReflection({
            subject: reflection.subject || subject,
            insight,
            confidence: Math.max(0.4, reflection.confidence - 0.2),
            relatedKeys: signal.dominantKeys || [],
            source: "reflection-engine-detail"
          });
        }
      }
    }

  } catch {
    // 🔒 ABSOLUTE FAIL-SAFE — never break main flow
  }
}


module.exports = { maybeRunReflection };