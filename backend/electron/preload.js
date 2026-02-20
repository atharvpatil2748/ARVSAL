const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arvsal", {
  sendCommand: (command) =>
    ipcRenderer.invoke("arvsal:command", command),

  sendAudio: (wavBuffer) =>
    ipcRenderer.invoke("arvsal:audio", wavBuffer),

  speak: (text) =>
    ipcRenderer.invoke("arvsal:speak", text),

  onWake: (cb) =>
    ipcRenderer.on("arvsal:wake", cb),

  resumeWake: () =>
    ipcRenderer.send("arvsal:resumeWake"),

  stopWake: () =>
    ipcRenderer.send("arvsal:stopWake")
});


