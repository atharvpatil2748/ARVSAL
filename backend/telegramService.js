const axios = require("axios")
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");  // 🔥 THIS ONE

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let lastUpdateId = null;

/* ================= SEND MESSAGE ================= */

async function sendTelegramMessage(text) {
  if (!TOKEN || !CHAT_ID) return;

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text
    });
  } catch (err) {
    console.log("Telegram send error:", err?.message);
  }
}

/* ================= POLLING ================= */

async function fetchUpdates() {
  if (!TOKEN) return [];

  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TOKEN}/getUpdates`,
      {
        params: {
          offset: lastUpdateId ? lastUpdateId + 1 : undefined,
          timeout: 10
        }
      }
    );

    const updates = response.data.result;

    if (updates.length > 0) {
      lastUpdateId = updates[updates.length - 1].update_id;
    }

    return updates;
  } catch (err) {
    console.log("Telegram polling error:", err?.message);
    return [];
  }
}

async function sendTelegramDocument(filePath) {

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", fs.createReadStream(filePath));

  await axios.post(
    `https://api.telegram.org/bot${token}/sendDocument`,
    formData,
    {
      headers: formData.getHeaders()   // ✅ Now this works
    }
  );
}

async function downloadTelegramFile(fileId, fileName) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  // 1️⃣ Get file path from Telegram
  const fileRes = await axios.get(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );

  const filePath = fileRes.data.result.file_path;

  // 2️⃣ Download actual file
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

  const response = await axios({
    url: fileUrl,
    method: "GET",
    responseType: "stream"
  });

  // 🔥 Change this folder if you want
  const saveFolder = "C:\\Users\\athar\\Downloads";

  if (!fs.existsSync(saveFolder)) {
    fs.mkdirSync(saveFolder, { recursive: true });
  }

  const savePath = path.join(saveFolder, fileName);

  const writer = fs.createWriteStream(savePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function downloadTelegramFileToBuffer(fileId) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN; 
    
    // 1. Get the path
    const fileInfo = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    
    if (!fileInfo.data || !fileInfo.data.ok) {
        throw new Error("Telegram API could not locate file");
    }

    const filePath = fileInfo.data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    
    // 2. Download with extended timeout for heavy PDFs
    const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'arraybuffer',
        timeout: 60000, // 60 seconds for larger files
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });
    
    console.log(`✅ Successfully buffered: ${fileId}`);
    return Buffer.from(response.data);
  } catch (err) {
    // Check if it's a file size limit issue
    if (err.response && err.response.status === 400) {
        console.error("❌ Telegram 400: File might be too large (>20MB) or Token is invalid.");
    } else {
        console.error(`❌ Buffer Download Failed:`, err.message);
    }
    return null; 
  }
}






module.exports = {
  sendTelegramMessage,
  fetchUpdates,
  sendTelegramDocument,
  downloadTelegramFile,
  downloadTelegramFileToBuffer
};