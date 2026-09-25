const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("reproMonitor", {
  request: (path, init) => ipcRenderer.invoke("monitor:request", path, init),
  subscribe: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("monitor:event", listener);
    ipcRenderer.send("monitor:subscribe");
    return () => {
      ipcRenderer.removeListener("monitor:event", listener);
      ipcRenderer.send("monitor:unsubscribe");
    };
  },
});
