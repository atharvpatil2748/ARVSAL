const memory = require("./memory");


/* ================= SUBJECT RESOLUTION ================= */

/**
 * Resolve subject deterministically from text
 * NEVER hallucinate unknown subjects
 */
function resolveSubject(text = "") {
  if (typeof text !== "string") {
    return { owner: "user", subject: "user" };
  }

  const lower = text.toLowerCase();

  // Explicit self-reference
  if (/\b(i|me|my|mine)\b/.test(lower)) {
    return { owner: "user", subject: "user" };
  }

  // Arvsal reference
  if (/\b(your|you)\b/.test(lower)) {
    return { owner: "arvsal", subject: "arvsal" };
  }

  // 🔒 Resolve ONLY subjects that exist in memory
  const knownSubjects = Object.keys(memory.facts || {});

  for (const subject of knownSubjects) {
    if (lower.includes(subject)) {
      return { owner: "person", subject };
    }
  }

  // Unknown person → safe fallback (no hallucination)
  return { owner: "unknown", subject: null };
}


/* ================= RESPONSE FORMAT ================= */

/**
 * Human-aligned response formatting
 * Uses createdAt (when told), not updatedAt
 */
function formatResponse(subject, key, value, meta = {}) {
  const timeHint = meta.createdAt
    ? ` (told ${humanTime(meta.createdAt)})`
    : "";

  if (subject === "user") {
    return `Your ${key} is ${value}${timeHint}.`;
  }

  if (subject === "arvsal") {
    return `My ${key} is ${value}${timeHint}.`;
  }

  if (!subject) {
    return `I don’t have enough information about that.`;
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

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return "a while ago";
}


module.exports = {
  resolveSubject,
  formatResponse
};









// const memory = require("./memory");

// /* ================= SUBJECT RESOLUTION ================= */

// /**
//  * Resolve subject deterministically from text
//  * NEVER hallucinate unknown subjects
//  */
// function resolveSubject(text = "") {
//   if (typeof text !== "string") {
//     return { owner: "user", subject: "user" };
//   }

//   const lower = text.toLowerCase();

//   // Explicit self-reference
//   if (/\b(i|me|my|mine)\b/.test(lower)) {
//     return { owner: "user", subject: "user" };
//   }

//   // Arvsal reference
//   if (/\b(your|you)\b/.test(lower)) {
//     return { owner: "arvsal", subject: "arvsal" };
//   }

//   // Resolve ONLY known memory subjects
//   const subjects = Object.keys(
//     memory.summarize ? memory.summarize("user").reduce((acc, f) => acc, {}) : {}
//   );

//   for (const subject of subjects) {
//     if (lower.includes(subject)) {
//       return { owner: "person", subject };
//     }
//   }

//   // Safe default
//   return { owner: "user", subject: "user" };
// }

// /* ================= RESPONSE FORMAT ================= */

// function formatResponse(subject, key, value, meta = {}) {
//   const timeHint = meta.updatedAt
//     ? ` (remembered ${humanTime(meta.updatedAt)})`
//     : "";

//   if (subject === "user") {
//     return `Your ${key} is ${value}${timeHint}.`;
//   }

//   if (subject === "arvsal") {
//     return `My ${key} is ${value}${timeHint}.`;
//   }

//   return `${capitalize(subject)}'s ${key} is ${value}${timeHint}.`;
// }

// /* ================= UTIL ================= */

// function capitalize(str = "") {
//   return str.charAt(0).toUpperCase() + str.slice(1);
// }

// function humanTime(ts) {
//   if (!ts) return "";
//   const diff = Date.now() - ts;
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
//   if (days === 0) return "recently";
//   if (days === 1) return "yesterday";
//   if (days < 7) return `${days} days ago`;
//   if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
//   return "a while ago";
// }

// module.exports = {
//   resolveSubject,
//   formatResponse
// };







