const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arvsal", {
  sendCommand: (command) =>
    ipcRenderer.invoke("arvsal:command", command),

  sendAudio: (wavBuffer) =>
    ipcRenderer.invoke("arvsal:audio", wavBuffer),

  sendFinalAudio: (buffer) =>
    ipcRenderer.invoke("arvsal:finalAudio", buffer),

  speak: (text) =>
    ipcRenderer.invoke("arvsal:speak", text),

  onWake: (cb) =>
    ipcRenderer.on("arvsal:wake", cb),

  resumeWake: () =>
    ipcRenderer.send("arvsal:resumeWake"),

  stopWake: () =>
    ipcRenderer.send("arvsal:stopWake"),
  
  streamAudio: (buffer) => 
    ipcRenderer.invoke("arvsal:streamAudio", buffer),

  onHotkey: (cb) => {
    ipcRenderer.removeAllListeners("arvsal:hotkey");
    ipcRenderer.on("arvsal:hotkey", cb);
  }
});











// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("arvsal", {
//   sendCommand: (command) =>
//     ipcRenderer.invoke("arvsal:command", command),

//   sendAudio: (wavBuffer) =>
//     ipcRenderer.invoke("arvsal:audio", wavBuffer),

//   speak: (text) =>
//     ipcRenderer.invoke("arvsal:speak", text),

//   onWake: (cb) =>
//     ipcRenderer.on("arvsal:wake", cb),

//   resumeWake: () =>
//     ipcRenderer.send("arvsal:resumeWake"),

//   stopWake: () =>
//     ipcRenderer.send("arvsal:stopWake"),
  
//   streamAudio: (buffer) => 
//     ipcRenderer.invoke("arvsal:streamAudio", buffer)
// });



