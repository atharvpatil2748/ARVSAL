const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");

let client = null;

function startWhatsApp(onMessage) {
  const sessionDir = process.env.ARVSAL_WHATSAPP_SESSION_DIR || path.resolve(__dirname, "../runtime/sessions/whatsapp");

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionDir
    }),
    webVersionCache: {
      type: "local",
      path: path.join(sessionDir, ".wwebjs_cache")
    }
  });

  const QRCode = require("qrcode");

    client.on('qr', async qr => {
    await QRCode.toFile("whatsapp-qr.png", qr);
    console.log("📱 QR saved as whatsapp-qr.png");
    });

  client.on("ready", () => {
    console.log("✅ WhatsApp connected");
  });

  client.on("message_create", async msg => {
    onMessage(msg);
 });

  client.initialize();
}

function sendMessage(to, text) {
  if (!client) return;
  return client.sendMessage(to, text);
}

module.exports = {
  startWhatsApp,
  sendMessage
};