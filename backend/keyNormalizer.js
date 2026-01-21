function normalizeKey(key) {
  if (!key) return "";

  key = key.toLowerCase();

  /* =====================================================
     🔒 FIX #1: remove possessive FIRST
     Prevents:
     "vandana's favourite colour"
     → "s favourite colour"
  ===================================================== */

  key = key.replace(/'s\b/g, "");

  // remove pronouns (existing behavior preserved)
  key = key.replace(/\b(my|your|his|her|their)\b/g, "");

  /* =====================================================
     🔒 FIX #2: remove punctuation (existing behavior)
     Safe now because possessive is already handled
  ===================================================== */

  key = key.replace(/[^a-z0-9\s]/g, "");

  // normalize spaces (existing behavior)
  key = key.replace(/\s+/g, " ").trim();

  /* =====================================================
     🔒 FIX #3: normalize synonyms (existing logic preserved)
  ===================================================== */

  if (key.includes("birth")) return "birthday";

  return key;
}

module.exports = normalizeKey;







// function normalizeKey(key) {
//   if (!key) return "";

//   key = key.toLowerCase();

//   // remove pronouns
//   key = key.replace(/\b(my|your|his|her|their)\b/g, "");

//   // remove punctuation (CRITICAL FIX)
//   key = key.replace(/[^a-z0-9\s]/g, "");

//   // normalize spaces
//   key = key.replace(/\s+/g, " ").trim();

//   // normalize synonyms
//   if (key.includes("birth")) return "birthday";

//   return key;
// }

// module.exports = normalizeKey;
