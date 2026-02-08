/**
 * Confirmation Manager
 *
 * Handles short-lived, single-use confirmations
 * (e.g., shutdown, restart, destructive actions)
 *
 * IMPORTANT:
 * - Confirmations are NOT memory
 * - Confirmations automatically expire
 */

let pending = null;

// ⏱️ Confirmation validity window (human-like)
const CONFIRMATION_TTL_MS = 30 * 1000; // 30 seconds

/* ================= INTERNAL ================= */

function isExpired(entry) {
  return !entry || Date.now() - entry.createdAt > CONFIRMATION_TTL_MS;
}

/* ================= SET ================= */

function setConfirmation(payload) {
  if (!payload || typeof payload !== "object") return;

  // 🔒 Do not override an active confirmation
  if (pending && !isExpired(pending)) return;

  const execute =
    typeof payload.execute === "function" ? payload.execute : null;

  pending = {
    execute,
    createdAt: Date.now()
  };
}

/* ================= GET ================= */

function getConfirmation() {
  if (!pending) return null;

  if (isExpired(pending)) {
    pending = null;
    return null;
  }

  // 🔒 Return a shallow copy to prevent mutation
  return { ...pending };
}

/* ================= CLEAR ================= */

function clearConfirmation() {
  pending = null;
}

module.exports = {
  setConfirmation,
  getConfirmation,
  clearConfirmation
};















// /**
//  * Confirmation Manager
//  *
//  * Handles short-lived, single-use confirmations
//  * (e.g., shutdown, restart, destructive actions)
//  *
//  * IMPORTANT:
//  * - Confirmations are NOT memory
//  * - Confirmations automatically expire
//  */

// let pending = null;

// // ⏱️ Confirmation validity window (human-like)
// const CONFIRMATION_TTL_MS = 30 * 1000; // 30 seconds

// /* ================= SET ================= */

// function setConfirmation(payload) {
//   if (!payload || typeof payload !== "object") return;

//   pending = {
//     ...payload,
//     createdAt: Date.now()
//   };
// }

// /* ================= GET ================= */

// function getConfirmation() {
//   if (!pending) return null;

//   const now = Date.now();

//   // 🔒 Auto-expire stale confirmations
//   if (now - pending.createdAt > CONFIRMATION_TTL_MS) {
//     pending = null;
//     return null;
//   }

//   return pending;
// }

// /* ================= CLEAR ================= */

// function clearConfirmation() {
//   pending = null;
// }

// module.exports = {
//   setConfirmation,
//   getConfirmation,
//   clearConfirmation
// };



