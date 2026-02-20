const input = document.getElementById("input");
const output = document.getElementById("output");
const btn = document.getElementById("send");

btn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;

  output.textContent = "Thinking...";

  try {
    const res = await window.arvsal.sendCommand(text);

    if (res?.reply) {
      output.textContent = res.reply;
    } else if (res?.error) {
      output.textContent = "Error: " + res.error;
    } else {
      output.textContent = "No response";
    }

  } catch (err) {
    output.textContent = "IPC Error: " + err.message;
  }
});