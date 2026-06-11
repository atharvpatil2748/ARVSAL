/**
 * Subject Resolution Layer - Phase 2 Pre-Hardening
 *
 * Deterministically resolves pronouns and entities from raw query text.
 * Prevents memory contamination by strictly defining query targets.
 */

'use strict';

const NAME_ALIASES = {
  sajal: "sejal", sajol: "sejal", segal: "sejal",
  sahal: "sahil",
  omkar: "omkar",
  vandna: "vandana"
};

const KNOWN_NAMES = new Set(["sejal", "sahil", "omkar", "vandana", "krishnat", "vardhan", "parth", "pratham"]);

/**
 * Resolves the primary subject and any secondary subjects from the query.
 * @param {string} text - Raw user query
 * @returns {{ primary: string, secondary: string[], confidence: number }}
 */
function resolveSubjects(text = "") {
  const lower = text.toLowerCase();
  
  let primary = "user"; // default
  let secondary = new Set();
  let confidence = 0.5;

  // 1. Check for explicit ARVSAL references (you/your/arvsal)
  // "What is your goal?" -> arvsal
  // "When did you start?" -> arvsal
  if (/\b(you|your|yourself|arvsal)\b/i.test(lower)) {
    primary = "arvsal";
    confidence = 0.9;
  }

  // 2. Check for explicit User references (I/me/my)
  // "Who am I?" -> user
  // "What is my branch?" -> user
  if (/\b(i|me|my|mine|myself|am i)\b/i.test(lower)) {
    // If arvsal was already matched, it's a mixed query (e.g., "Do you remember my name?")
    if (primary === "arvsal") {
      secondary.add("user");
      // Which one is the primary? Usually "my [noun]" takes precedence for factual memory
      if (/\bmy\b/.test(lower)) {
        primary = "user";
        secondary.add("arvsal");
      }
    } else {
      primary = "user";
      confidence = 0.9;
    }
  }

  // 3. Check for specific named entities
  const tokens = lower.match(/\b[a-z]{3,}\b/g) || [];
  for (const token of tokens) {
    let resolvedName = null;
    if (NAME_ALIASES[token]) {
      resolvedName = NAME_ALIASES[token];
    } else if (KNOWN_NAMES.has(token)) {
      resolvedName = token;
    }

    if (resolvedName) {
      if (primary === "user" || primary === "arvsal") {
        secondary.add(primary); // demote previous to secondary
        primary = resolvedName;
        confidence = 0.95;
      } else if (primary !== resolvedName) {
        secondary.add(resolvedName);
      }
    }
  }

  return {
    primary,
    secondary: Array.from(secondary),
    confidence
  };
}

module.exports = {
  resolveSubjects
};
