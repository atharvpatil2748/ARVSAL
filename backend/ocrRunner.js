const tesseract = require("node-tesseract-ocr");

async function runOCR(imagePath) {

  const config = {
    lang: "eng",
    oem: 1,
    psm: 4,
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_{}[]();:.,=+-/*\\",
    preserve_interword_spaces: 1
  };

  try {
    const text = await tesseract.recognize(imagePath, config);
    return text.trim();
  } catch (err) {
    throw new Error("OCR failed: " + err.message);
  }
}

module.exports = { runOCR };