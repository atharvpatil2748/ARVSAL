const chat = document.getElementById("chat");
const input = document.getElementById("command");

/* ================= CHAT HELPERS ================= */

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "6px";
  div.innerText = (role === "user" ? "You: " : "Arvsal: ") + text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* ================= HISTORY (ONLY ON LOAD) ================= */

async function loadHistory() {
  try {
    const res = await fetch("http://localhost:3000/history");
    const history = await res.json();

    chat.innerHTML = "";
    history.forEach(m => appendMessage(m.role, m.text));
  } catch (e) {
    console.error("History load failed", e);
  }
}

/* ================= SEND COMMAND ================= */

async function sendCommand(textOverride) {
  const text = textOverride || input.value.trim();
  if (!text) return;

  input.value = "";

  // ✅ SHOW USER MESSAGE IMMEDIATELY
  appendMessage("user", text);

  try {
    const res = await fetch("http://localhost:3000/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: text })
    });

    const data = await res.json();

    // ✅ SHOW ARVSAL MESSAGE IMMEDIATELY
    if (data.reply && data.reply !== "__HANDLED_EXTERNALLY__") {
      appendMessage("arvsal", data.reply);
      speak(data.reply);
    }
  } catch (err) {
    console.error("Backend error", err);
  }
}

/* ================= TTS ================= */

let speaking = false;
let queue = [];
let lastSpoken = "";
let voices = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

function splitText(text, max = 220) {
  const parts = [];
  let current = "";
  for (const word of text.split(" ")) {
    if ((current + word).length <= max) current += word + " ";
    else {
      parts.push(current.trim());
      current = word + " ";
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function speak(text) {
  if (!text || text === lastSpoken) return;
  lastSpoken = text;

  speechSynthesis.cancel();
  queue = splitText(text);
  speaking = true;
  speakNext();
}

function speakNext() {
  if (!queue.length) {
    speaking = false;
    return;
  }

  const u = new SpeechSynthesisUtterance(queue.shift());
  u.rate = 1.1;
  u.pitch = 0.9;

  const v = voices.find(v => v.name.includes("Google UK English Male"));
  if (v) u.voice = v;

  u.onend = speakNext;
  speechSynthesis.speak(u);
}

/* ================= SPEECH RECOGNITION ================= */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let micBusy = false;
let listening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = e => {
    micBusy = false;
    sendCommand(e.results[0][0].transcript.trim());
  };

  recognition.onend = () => {
    micBusy = false;
    if (listening && !speaking) startMic();
  };
}

function startMic() {
  if (micBusy || speaking) return;
  try {
    micBusy = true;
    recognition.start();
  } catch {}
}

function toggleMic() {
  if (!recognition) return alert("Speech recognition not supported");

  listening = !listening;

  if (listening) startMic();
  else {
    micBusy = false;
    speechSynthesis.cancel();
    queue = [];
    speaking = false;
    try { recognition.abort(); } catch {}
  }
}

/* ================= INIT ================= */

loadHistory(); // ONLY once













// const chat = document.getElementById("chat");
// const input = document.getElementById("command");

// // ================= UNLOCK AUDIO =================
// let audioUnlocked = false;

// function unlockAudio() {
//   if (audioUnlocked) return;

//   try {
//     const u = new SpeechSynthesisUtterance("");
//     speechSynthesis.speak(u); // 🔒 real unlock
//     audioUnlocked = true;
//     console.log("🔓 Audio unlocked");
//   } catch {}
// }

// ["click", "keydown", "touchstart"].forEach(evt => {
//   document.addEventListener(evt, unlockAudio, { once: true });
// });

// // ================= CHAT HISTORY =================
// async function loadHistory() {
//   try {
//     const res = await fetch("http://localhost:3000/history");
//     const history = await res.json();

//     chat.innerHTML = "";
//     history.forEach(msg => {
//       const div = document.createElement("div");
//       div.style.marginBottom = "6px";
//       div.innerText =
//         (msg.role === "user" ? "You: " : "Arvsal: ") + msg.text;
//       chat.appendChild(div);
//     });

//     chat.scrollTop = chat.scrollHeight;
//   } catch {}
// }

// // ================= TEXT SPLIT =================
// function splitText(text, max = 220) {
//   const parts = [];
//   let current = "";

//   for (const word of text.split(" ")) {
//     if ((current + word).length <= max) {
//       current += word + " ";
//     } else {
//       parts.push(current.trim());
//       current = word + " ";
//     }
//   }
//   if (current.trim()) parts.push(current.trim());
//   return parts;
// }

// // ================= BROWSER TTS =================
// let speaking = false;
// let queue = [];
// let lastSpoken = ""; // 🔒 prevent duplicate speech

// let voices = [];
// speechSynthesis.onvoiceschanged = () => {
//   voices = speechSynthesis.getVoices();
// };

// function speak(text) {
//   if (!text) return;
//   if (text === "__HANDLED_EXTERNALLY__") return;
//   if (text === lastSpoken) return;

//   lastSpoken = text;

//   // Cancel ONLY for new reply
//   speechSynthesis.cancel();

//   // Stop mic while speaking
//   if (recognition) {
//     try { recognition.abort(); } catch {}
//   }

//   queue = splitText(text);
//   speaking = true;

//   speakNext();
// }

// function speakNext() {
//   if (queue.length === 0) {
//     speaking = false;
//     if (listening) setTimeout(forceRestartMic, 800);
//     return;
//   }

//   const utterance = new SpeechSynthesisUtterance(queue.shift());

//   utterance.rate = 1.10;
//   utterance.pitch = 0.9;
//   utterance.volume = 1;

//   const preferredVoice = voices.find(v =>
//     v.name.includes("Google UK English Male")
//   );
//   if (preferredVoice) utterance.voice = preferredVoice;

//   utterance.onend = speakNext;
//   speechSynthesis.speak(utterance);
// }

// // ================= SEND COMMAND =================
// async function sendCommand(textOverride) {
//   const text = textOverride || input.value.trim();
//   if (!text) return;

//   input.value = "";

//   try {
//     const res = await fetch("http://localhost:3000/command", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ command: text })
//     });

//     const data = await res.json();
//     await loadHistory();

//     if (data.reply && data.reply !== "__HANDLED_EXTERNALLY__") {
//       speak(data.reply);
//     }
//   } catch (err) {
//     console.error("Backend error", err);
//   }
// }

// // ================= SPEECH RECOGNITION =================
// const SpeechRecognition =
//   window.SpeechRecognition || window.webkitSpeechRecognition;

// let recognition;
// let listening = false;
// let micBusy = false;

// if (SpeechRecognition) {
//   recognition = new SpeechRecognition();
//   recognition.lang = "en-US";
//   recognition.interimResults = false;
//   recognition.continuous = false;

//   recognition.onresult = (event) => {
//     const text = event.results[0][0].transcript.trim();
//     if (!text) return;
//     micBusy = true;
//     sendCommand(text);
//   };

//   recognition.onerror = () => {
//     micBusy = false;
//     if (listening && !speaking) {
//       setTimeout(forceRestartMic, 800);
//     }
//   };

//   recognition.onend = () => {
//     micBusy = false;
//     if (listening && !speaking) {
//       setTimeout(forceRestartMic, 800);
//     }
//   };
// }

// // ================= MIC CONTROL =================
// function forceRestartMic() {
//   if (!listening || micBusy || speaking) return;
//   try {
//     recognition.start();
//     console.log("🎙 Mic restarted");
//   } catch {}
// }

// function toggleMic() {
//   if (!recognition) {
//     alert("Speech recognition not supported");
//     return;
//   }

//   if (!listening) {
//     listening = true;
//     forceRestartMic();
//     console.log("🎙 Mic ON");
//   } else {
//     listening = false;
//     recognition.abort();
//     speechSynthesis.cancel();
//     queue = [];
//     speaking = false;
//     console.log("🛑 Mic OFF");
//   }
// }

// // ================= INIT =================
// loadHistory();






















// const chat = document.getElementById("chat");
// const input = document.getElementById("command");

// // ================= UNLOCK AUDIO =================
// let audioUnlocked = false;

// function unlockAudio() {
//   if (audioUnlocked) return;
//   speechSynthesis.resume();
//   audioUnlocked = true;
//   console.log("🔓 Audio unlocked");
// }

// ["click", "keydown", "touchstart"].forEach(evt => {
//   document.addEventListener(evt, unlockAudio, { once: true });
// });

// // ================= CHAT HISTORY =================
// async function loadHistory() {
//   try {
//     const res = await fetch("http://localhost:3000/history");
//     const history = await res.json();

//     chat.innerHTML = "";
//     history.forEach(msg => {
//       const div = document.createElement("div");
//       div.style.marginBottom = "6px";
//       div.innerText =
//         (msg.role === "user" ? "You: " : "Arvsal: ") + msg.text;
//       chat.appendChild(div);
//     });

//     chat.scrollTop = chat.scrollHeight;
//   } catch {}
// }

// // ================= TEXT SPLIT (FIXED) =================
// // Larger chunks → fewer pauses → faster speech
// function splitText(text, max = 220) {
//   const parts = [];
//   let current = "";

//   for (const word of text.split(" ")) {
//     if ((current + word).length <= max) {
//       current += word + " ";
//     } else {
//       parts.push(current.trim());
//       current = word + " ";
//     }
//   }
//   if (current.trim()) parts.push(current.trim());
//   return parts;
// }

// // ================= BROWSER TTS =================
// let speaking = false;
// let queue = [];

// // Preload voices (CRITICAL for Chrome)
// let voices = [];
// speechSynthesis.onvoiceschanged = () => {
//   voices = speechSynthesis.getVoices();
// };

// function speak(text) {
//   if (!text) return;

//   // 🚫 DO NOT cancel mid-sentence unless new reply
//   speechSynthesis.cancel();

//   // Stop mic while speaking (prevents self-trigger)
//   if (recognition) {
//     try { recognition.abort(); } catch {}
//   }

//   queue = splitText(text);
//   speaking = true;

//   speakNext();
// }

// function speakNext() {
//   if (queue.length === 0) {
//     speaking = false;
//     // 🎙 Restart mic ONLY after speech fully ends
//     if (listening) setTimeout(forceRestartMic, 800);
//     return;
//   }

//   const utterance = new SpeechSynthesisUtterance(queue.shift());

//   // 🎙 JARVIS-LIKE VOICE TUNING
//   utterance.rate = 1.10;   // faster, natural
//   utterance.pitch = 0.9;   // calm, mature
//   utterance.volume = 1;

//   // Prefer Google UK Male (Jarvis-like)
//   const preferredVoice = voices.find(v =>
//     v.name.includes("Google UK English Male")
//   );
//   if (preferredVoice) {
//     utterance.voice = preferredVoice;
//   }

//   utterance.onend = speakNext;
//   speechSynthesis.speak(utterance);
// }

// // ================= SEND COMMAND =================
// async function sendCommand(textOverride) {
//   const text = textOverride || input.value.trim();
//   if (!text) return;

//   input.value = "";

//   try {
//     const res = await fetch("http://localhost:3000/command", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ command: text })
//     });

//     const data = await res.json();
//     await loadHistory();

//     if (data.reply) speak(data.reply);
//   } catch (err) {
//     console.error("Backend error", err);
//   }
// }

// // ================= SPEECH RECOGNITION =================
// const SpeechRecognition =
//   window.SpeechRecognition || window.webkitSpeechRecognition;

// let recognition;
// let listening = false;
// let micBusy = false;

// if (SpeechRecognition) {
//   recognition = new SpeechRecognition();
//   recognition.lang = "en-US";
//   recognition.interimResults = false;
//   recognition.continuous = false;

//   recognition.onresult = (event) => {
//     const text = event.results[0][0].transcript.trim();
//     if (!text) return;
//     micBusy = true;
//     sendCommand(text);
//   };

//   recognition.onerror = () => {
//     micBusy = false;
//     if (listening && !speaking) {
//       setTimeout(forceRestartMic, 800);
//     }
//   };

//   recognition.onend = () => {
//     micBusy = false;
//     if (listening && !speaking) {
//       setTimeout(forceRestartMic, 800);
//     }
//   };
// }

// // ================= MIC CONTROL =================
// function forceRestartMic() {
//   if (!listening || micBusy || speaking) return;
//   try {
//     recognition.start();
//     console.log("🎙 Mic restarted");
//   } catch {}
// }

// function toggleMic() {
//   if (!recognition) {
//     alert("Speech recognition not supported");
//     return;
//   }

//   if (!listening) {
//     listening = true;
//     forceRestartMic();
//     console.log("🎙 Mic ON");
//   } else {
//     listening = false;
//     recognition.abort();
//     speechSynthesis.cancel();
//     queue = [];
//     speaking = false;
//     console.log("🛑 Mic OFF");
//   }
// }

// // ================= INIT =================
// loadHistory();









// const chat = document.getElementById("chat");
// const input = document.getElementById("command");

// // ================= UNLOCK AUDIO =================
// let audioUnlocked = false;

// function unlockAudio() {
//   if (audioUnlocked) return;
//   speechSynthesis.resume();
//   audioUnlocked = true;
//   console.log("🔓 Audio unlocked");
// }

// // Unlock on ANY user interaction
// ["click", "keydown", "touchstart"].forEach(evt => {
//   document.addEventListener(evt, unlockAudio, { once: true });
// });


// // ================= CHAT HISTORY =================
// async function loadHistory() {
//   try {
//     const res = await fetch("http://localhost:3000/history");
//     const history = await res.json();

//     chat.innerHTML = "";
//     history.forEach(msg => {
//       const div = document.createElement("div");
//       div.style.marginBottom = "6px";
//       div.innerText =
//         (msg.role === "user" ? "You: " : "Arvsal: ") + msg.text;
//       chat.appendChild(div);
//     });

//     chat.scrollTop = chat.scrollHeight;
//   } catch {}
// }

// // ================= TEXT SPLIT (CRITICAL) =================
// function splitText(text, max = 140) {
//   const parts = [];
//   let current = "";

//   for (const word of text.split(" ")) {
//     if ((current + word).length < max) {
//       current += word + " ";
//     } else {
//       parts.push(current.trim());
//       current = word + " ";
//     }
//   }
//   if (current.trim()) parts.push(current.trim());
//   return parts;
// }

// // ================= BROWSER TTS =================
// let speaking = false;
// let queue = [];

// function speak(text) {
//   if (!text) return;
//   speechSynthesis.resume();

//   // Stop mic
//   if (recognition) {
//     try { recognition.abort(); } catch {}
//   }

//   speechSynthesis.cancel();
//   queue = splitText(text);
//   speaking = true;

//   speakNext();
// }

// function speakNext() {
//   if (queue.length === 0) {
//     speaking = false;
//     if (listening) setTimeout(forceRestartMic, 400);
//     return;
//   }

//   const utterance = new SpeechSynthesisUtterance(queue.shift());

//   // 🔴 DO NOT SET utterance.voice
//   utterance.rate = 1;
//   utterance.pitch = 1;
//   utterance.volume = 1;

//   utterance.onend = speakNext;
//   speechSynthesis.speak(utterance);
// }

// // ================= SEND COMMAND =================
// async function sendCommand(textOverride) {
//   const text = textOverride || input.value.trim();
//   if (!text) return;

//   input.value = "";

//   try {
//     const res = await fetch("http://localhost:3000/command", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ command: text })
//     });

//     const data = await res.json();
//     await loadHistory();

//     if (data.reply) speak(data.reply);
//   } catch (err) {
//     console.error("Backend error", err);
//   }
// }

// // ================= SPEECH RECOGNITION =================
// const SpeechRecognition =
//   window.SpeechRecognition || window.webkitSpeechRecognition;

// let recognition;
// let listening = false;
// let micBusy = false;

// if (SpeechRecognition) {
//   recognition = new SpeechRecognition();
//   recognition.lang = "en-US";
//   recognition.interimResults = false;
//   recognition.continuous = false;

//   recognition.onresult = (event) => {
//     const text = event.results[0][0].transcript.trim();
//     if (!text) return;
//     micBusy = true;
//     sendCommand(text);
//   };

//   recognition.onerror = () => {
//     micBusy = false;
//     if (listening) setTimeout(forceRestartMic, 400);
//   };

//   recognition.onend = () => {
//     micBusy = false;
//     if (listening && !speaking) {
//       setTimeout(forceRestartMic, 400);
//     }
//   };
// }

// // ================= MIC CONTROL =================
// function forceRestartMic() {
//   if (!listening || micBusy || speaking) return;
//   try {
//     recognition.abort();
//     recognition.start();
//     console.log("🎙 Mic restarted");
//   } catch {}
// }

// function toggleMic() {
//   if (!recognition) {
//     alert("Speech recognition not supported");
//     return;
//   }

//   if (!listening) {
//     listening = true;
//     forceRestartMic();
//     console.log("🎙 Mic ON");
//   } else {
//     listening = false;
//     recognition.abort();
//     speechSynthesis.cancel();
//     queue = [];
//     speaking = false;
//     console.log("🛑 Mic OFF");
//   }
// }

// // ================= INIT =================
// loadHistory();















