/**
 * Date Resolver
 *
 * Converts natural language time references
 * into deterministic date ranges.
 *
 * NO LLM
 * NO MEMORY ACCESS
 */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = x.getDate() - day + (day === 0 ? -6 : 1); // Monday
  x.setDate(diff);
  return startOfDay(x);
}

function endOfWeek(d) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return endOfDay(end);
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function resolveDateRange(text = "") {
  text = text.toLowerCase().trim();
  const now = new Date();

  /* ===== TODAY ===== */
  if (/\btoday\b/.test(text)) {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  /* ===== YESTERDAY ===== */
  if (/\byesterday\b/.test(text)) {
    const d = daysAgo(1);
    return { start: startOfDay(d), end: endOfDay(d) };
  }

  /* ===== THIS WEEK ===== */
  if (/\bthis week\b/.test(text)) {
    return {
      start: startOfWeek(now),
      end: endOfWeek(now)
    };
  }

  /* ===== LAST WEEK (previous calendar week) ===== */
  if (/\blast week\b/.test(text)) {
    const lastWeek = daysAgo(7);
    return {
      start: startOfWeek(lastWeek),
      end: endOfWeek(lastWeek)
    };
  }

  /* ===== THIS MONTH ===== */
  if (/\bthis month\b/.test(text)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: startOfDay(start),
      end: endOfDay(end)
    };
  }

  /* ===== LAST MONTH ===== */
  if (/\blast month\b/.test(text)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: startOfDay(start),
      end: endOfDay(end)
    };
  }

  /* ===== LAST X DAYS ===== */
  const daysMatch = text.match(/\b(last|past)\s+(\d+)\s+days?\b/);
  if (daysMatch) {
    const n = parseInt(daysMatch[2], 10);
    if (!isNaN(n) && n > 0) {
      return {
        start: startOfDay(daysAgo(n)),
        end: endOfDay(daysAgo(1))
      };
    }
  }

  /* ===== SPECIFIC DATE ===== */
  const dateMatch = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/
  );

  if (dateMatch) {
    const day = parseInt(dateMatch[1] || dateMatch[4], 10);
    const monthStr = dateMatch[2] || dateMatch[3];
    const month = MONTHS[monthStr];
    const year = now.getFullYear();

    if (!isNaN(day) && month !== undefined) {
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed)) {
        return {
          start: startOfDay(parsed),
          end: endOfDay(parsed)
        };
      }
    }
  }

  return null;
}

module.exports = { resolveDateRange };




















// /**
//  * Non-strict, SAFE date resolver
//  *
//  * - Accepts natural phrases
//  * - NEVER guesses
//  * - NEVER resolves future dates
//  * - Rejects invalid calendar dates
//  */

// function resolveDateRange(text = "") {
//   text = text.toLowerCase().trim();
//   const now = new Date();

//   /* ---------- TODAY ---------- */
//   if (/\btoday\b/.test(text)) {
//     return dayRange(now);
//   }

//   /* ---------- YESTERDAY ---------- */
//   if (/\byesterday\b/.test(text)) {
//     const d = new Date(now);
//     d.setDate(d.getDate() - 1);
//     return dayRange(d);
//   }

//   /* ---------- ISO YYYY-MM-DD ---------- */
//   const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
//   if (iso) {
//     const year = Number(iso[1]);
//     const month = Number(iso[2]) - 1;
//     const day = Number(iso[3]);

//     const d = new Date(year, month, day);

//     // 🔒 Reject invalid dates
//     if (
//       d.getFullYear() !== year ||
//       d.getMonth() !== month ||
//       d.getDate() !== day
//     ) {
//       return null;
//     }

//     // 🔒 Reject future
//     if (d > now) return null;

//     return dayRange(d);
//   }

//   /* ---------- "19 jan", "19 january" ---------- */
//   const natural = text.match(
//     /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/
//   );

//   if (natural) {
//     const day = Number(natural[1]);
//     const monthMap = {
//       jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
//       jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
//     };

//     const month = monthMap[natural[2]];

//     // Try current year
//     let d = new Date(now.getFullYear(), month, day);

//     // Invalid date → reject
//     if (
//       d.getMonth() !== month ||
//       d.getDate() !== day
//     ) {
//       return null;
//     }

//     // If future → try previous year
//     if (d > now) {
//       d = new Date(now.getFullYear() - 1, month, day);

//       if (
//         d.getMonth() !== month ||
//         d.getDate() !== day
//       ) {
//         return null;
//       }
//     }

//     // Still future? reject
//     if (d > now) return null;

//     return dayRange(d);
//   }

//   return null; // 🔒 SAFETY: no guessing
// }

// /* ---------- DAY RANGE ---------- */

// function dayRange(date) {
//   const start = new Date(date);
//   start.setHours(0, 0, 0, 0);

//   const end = new Date(date);
//   end.setHours(23, 59, 59, 999);

//   return { start, end };
// }

// module.exports = { resolveDateRange };






