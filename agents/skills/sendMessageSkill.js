const desktop = require('@tools/desktopTool');

function sleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

module.exports = async function sendMessageSkill(params = {}) {

  const text = params.text;
  if (!text) return { success:false, response:"No text provided." };

  try {

    /* 1️⃣ small delay → allow window switch */
    await sleep(800);

    /* 2️⃣ CLICK center of screen (focus window) ⭐ critical */
    const screen = require("robotjs").getScreenSize();

    await desktop.execute({
      action:"click",
      params:{
        x: Math.floor(screen.width*0.5),
        y: Math.floor(screen.height*0.85) // WhatsApp input area approx
      }
    });

    await sleep(300);

    /* 3️⃣ TYPE */
    await desktop.execute({
      action:"type",
      params:{ text, delay_ms:100 }
    });

    /* 4️⃣ ENTER */
    await desktop.execute({
      action:"keypress",
      params:{ key:"enter" }

    });
    return { success:true, response:`Sent: ${text}` };

  } catch (err){
    return { success:false, response:"send_message failed" };
  }
};