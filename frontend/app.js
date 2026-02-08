const chat = document.getElementById("chat");
const input = document.getElementById("command");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");

/* ================= UTIL ================= */

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])
  );
}

/* ================= RENDER ================= */

function renderMessage(role, rawText) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const { html, spokenText } = render(rawText);

  div.innerHTML = `
    <strong>${role === "user" ? "You" : "Arvsal"}:</strong>
    ${html}
  `;

  chat.appendChild(div);

  Prism.highlightAllUnder(div);
  if (window.MathJax) MathJax.typesetPromise([div]).catch(() => {});
  chat.scrollTop = chat.scrollHeight;

  if (role === "arvsal") speak(spokenText);

  // Copy buttons
  div.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      const code = btn.closest(".code-wrapper").querySelector("code").textContent;
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1200);
    };
  });
}

/* ================= MARKDOWN + CODE ================= */

function render(text) {
  let spokenText = text;
  let html = "";

  const fenceRegex = /```([\w+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(text)) !== null) {
    // Text before code
    const before = text.slice(lastIndex, match.index);
    html += escapeHTML(before).replace(/\n/g, "<br>");

    // Remove code from TTS
    spokenText = spokenText.replace(match[0], "");

    const lang = match[1] || "text";
    const code = match[2];

    html += `
      <div class="code-wrapper">
        <button class="copy-btn">Copy</button>
        <pre><code class="language-${lang}">${escapeHTML(code)}</code></pre>
      </div>
    `;

    lastIndex = fenceRegex.lastIndex;
  }

  // Remaining text
  html += escapeHTML(text.slice(lastIndex)).replace(/\n/g, "<br>");

  return { html, spokenText: spokenText.trim() };
}

/* ================= SEND ================= */

async function send(textOverride) {
  const text = textOverride || input.value.trim();
  if (!text) return;

  input.value = "";
  renderMessage("user", text);

  const res = await fetch("http://localhost:3000/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: text })
  });

  const data = await res.json();
  if (data.reply) renderMessage("arvsal", data.reply);
}

sendBtn.onclick = () => send();

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

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

/* ================= MIC ================= */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let listening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;

  recognition.onresult = e => {
    listening = false;
    micBtn.classList.remove("listening");
    send(e.results[0][0].transcript);
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove("listening");
  };
}

micBtn.onclick = () => {
  if (!recognition || speaking) return;

  if (listening) {
    recognition.stop();
    micBtn.classList.remove("listening");
    listening = false;
  } else {
    recognition.start();
    micBtn.classList.add("listening");
    listening = true;
  }
};









// const chat = document.getElementById("chat");
// const input = document.getElementById("command");

// /* ================= CHAT HELPERS ================= */

// function appendMessage(role, text) {
//   const div = document.createElement("div");
//   div.style.marginBottom = "6px";
//   div.innerText = (role === "user" ? "You: " : "Arvsal: ") + text;
//   chat.appendChild(div);
//   chat.scrollTop = chat.scrollHeight;
// }

// /* ================= HISTORY (ONLY ON LOAD) ================= */

// async function loadHistory() {
//   try {
//     const res = await fetch("http://localhost:3000/history");
//     const history = await res.json();

//     chat.innerHTML = "";
//     history.forEach(m => appendMessage(m.role, m.text));
//   } catch (e) {
//     console.error("History load failed", e);
//   }
// }

// /* ================= SEND COMMAND ================= */

// async function sendCommand(textOverride) {
//   const text = textOverride || input.value.trim();
//   if (!text) return;

//   input.value = "";

//   // ✅ SHOW USER MESSAGE IMMEDIATELY
//   appendMessage("user", text);

//   try {
//     const res = await fetch("http://localhost:3000/command", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ command: text })
//     });

//     const data = await res.json();

//     // ✅ SHOW ARVSAL MESSAGE IMMEDIATELY
//     if (data.reply && data.reply !== "__HANDLED_EXTERNALLY__") {
//       appendMessage("arvsal", data.reply);
//       speak(data.reply);
//     }
//   } catch (err) {
//     console.error("Backend error", err);
//   }
// }

// /* ================= TTS ================= */

// let speaking = false;
// let queue = [];
// let lastSpoken = "";
// let voices = [];

// speechSynthesis.onvoiceschanged = () => {
//   voices = speechSynthesis.getVoices();
// };

// function splitText(text, max = 220) {
//   const parts = [];
//   let current = "";
//   for (const word of text.split(" ")) {
//     if ((current + word).length <= max) current += word + " ";
//     else {
//       parts.push(current.trim());
//       current = word + " ";
//     }
//   }
//   if (current.trim()) parts.push(current.trim());
//   return parts;
// }

// function speak(text) {
//   if (!text || text === lastSpoken) return;
//   lastSpoken = text;

//   speechSynthesis.cancel();
//   queue = splitText(text);
//   speaking = true;
//   speakNext();
// }

// function speakNext() {
//   if (!queue.length) {
//     speaking = false;
//     return;
//   }

//   const u = new SpeechSynthesisUtterance(queue.shift());
//   u.rate = 1.1;
//   u.pitch = 0.9;

//   const v = voices.find(v => v.name.includes("Google UK English Male"));
//   if (v) u.voice = v;

//   u.onend = speakNext;
//   speechSynthesis.speak(u);
// }

// /* ================= SPEECH RECOGNITION ================= */

// const SpeechRecognition =
//   window.SpeechRecognition || window.webkitSpeechRecognition;

// let recognition;
// let micBusy = false;
// let listening = false;

// if (SpeechRecognition) {
//   recognition = new SpeechRecognition();
//   recognition.lang = "en-US";
//   recognition.interimResults = false;
//   recognition.continuous = false;

//   recognition.onresult = e => {
//     micBusy = false;
//     sendCommand(e.results[0][0].transcript.trim());
//   };

//   recognition.onend = () => {
//     micBusy = false;
//     if (listening && !speaking) startMic();
//   };
// }

// function startMic() {
//   if (micBusy || speaking) return;
//   try {
//     micBusy = true;
//     recognition.start();
//   } catch {}
// }

// function toggleMic() {
//   if (!recognition) return alert("Speech recognition not supported");

//   listening = !listening;

//   if (listening) startMic();
//   else {
//     micBusy = false;
//     speechSynthesis.cancel();
//     queue = [];
//     speaking = false;
//     try { recognition.abort(); } catch {}
//   }
// }

// /* ================= INIT ================= */

// loadHistory(); // ONLY once



