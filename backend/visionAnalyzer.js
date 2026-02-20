// backend/visionAnalyzer.js

function isTextHeavy(ocrText) {
  if (!ocrText) return false;

  const length = ocrText.length;
  const lineCount = ocrText.split("\n").length;

  // Heuristic rules
  if (length > 300) return true;
  if (lineCount > 15) return true;

  // Detect code patterns
  if (/function|class|import|def|while|for|console\.log/.test(ocrText))
    return true;

  return false;
}

module.exports = { isTextHeavy };