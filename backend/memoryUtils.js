/**
 * Memory Utilities
 *
 * Deterministic helpers for subject resolution
 * and human-aligned response formatting.
 *
 * NO memory mutation
 * NO hallucination
 */

const memory = require("./memory");

/* ================= SUBJECT RESOLUTION ================= */

/**
 * Resolve subject deterministically from text.
 * NEVER invent unknown subjects.
 * NEVER inspect memory internals.
 */
function resolveSubject(text = "") {
  if (typeof text !== "string" || !text.trim()) {
    return { subject: "user" };
  }

  const lower = text.toLowerCase();

  // Explicit self-reference
  if (/\b(i|me|my|mine)\b/.test(lower)) {
    return { subject: "user" };
  }

  // Arvsal reference
  if (/\b(your|you)\b/.test(lower)) {
    return { subject: "arvsal" };
  }

  /**
   * 🔒 Known subjects only — SAFE METHOD
   * We infer subjects ONLY if they already exist
   * in semantic memory via summarize().
   */
  const subjects = Object.keys(memory.summarizeAll?.() || {});

  for (const s of subjects) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");

    if (regex.test(lower)) {
      return { subject: s };
    }
  }

  // Unknown → safe fallback
  return { subject: "user" };
}

/* ================= RESPONSE FORMAT ================= */

/**
 * Human-aligned response formatting.
 * Time hints ONLY if explicitly provided.
 */
function formatResponse(subject, key, value, meta = {}) {
  if (!subject || !key) {
    return "I don’t have enough information about that.";
  }

  const timeHint =
    meta.createdAt && typeof meta.createdAt === "number"
      ? ` (told ${humanTime(meta.createdAt)})`
      : "";

  if (subject === "user") {
    return `Your ${key} is ${value}${timeHint}.`;
  }

  if (subject === "arvsal") {
    return `My ${key} is ${value}${timeHint}.`;
  }

  return `${capitalize(subject)}'s ${key} is ${value}${timeHint}.`;
}

/* ================= UTIL ================= */

function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function humanTime(ts) {
  if (!ts) return "";

  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return "a while ago";
}

module.exports = {
  resolveSubject,
  formatResponse
};








