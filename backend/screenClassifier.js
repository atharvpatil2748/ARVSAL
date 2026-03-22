// backend/screenClassifier.js

function classifyScreen(text = "") {

  const t = text.toLowerCase();

  // --- coding ---
  if (
    t.includes("function") ||
    t.includes("const ") ||
    t.includes("import ") ||
    t.includes("console.log") ||
    t.includes(".js") ||
    t.includes("python") ||
    t.includes("stack trace") ||
    t.includes("error:")
  ) return "coding";

  // --- terminal ---
  if (
    t.includes("npm start") ||
    t.includes("ps c:\\") ||
    t.includes("command not found") ||
    t.includes("node_modules") ||
    t.includes("ollama")
  ) return "terminal";

  // --- whatsapp ---
  if (
    t.includes("messages are end-to-end encrypted") ||
    t.includes("type a message") ||
    t.includes("search or start a new chat") ||
    t.includes("whatsapp")
  ) return "whatsapp";

  // --- browser ---
  if (
    t.includes("http") ||
    t.includes("www.") ||
    t.includes("login") ||
    t.includes("search") ||
    t.includes("iitk") ||
    t.includes("portal")
  ) return "browser";

  // --- pdf / study ---
  if (
    t.includes("abstract") ||
    t.includes("introduction") ||
    t.includes("chapter") ||
    t.includes("references") ||
    t.includes("figure")
  ) return "pdf";

  // --- cad (basic heuristic) ---
  if (
    t.includes("solidworks") ||
    t.includes("fusion") ||
    t.includes("sketch") ||
    t.includes("extrude") ||
    t.includes("dimension")
  ) return "cad";

  return "unknown";
}

module.exports = { classifyScreen };