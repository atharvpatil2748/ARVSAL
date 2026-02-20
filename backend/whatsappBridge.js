const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");


let client = null;

function startWhatsApp(onMessage) {

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true
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