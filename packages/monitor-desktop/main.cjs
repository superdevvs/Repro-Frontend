const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  Notification,
  shell,
} = require("electron");
const { request } = require("node:http");
const {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
let window,
  tray,
  stream,
  reconnect,
  quit = false;
let latest = null;
const seen = new Map();
const configPath =
  process.env.REPRO_MONITOR_DESKTOP_CONFIG || "/etc/repro-monitor/desktop.json";
let config;
function credentials() {
  if (!config) {
    config = JSON.parse(readFileSync(configPath, "utf8"));
    if (
      typeof config.socket !== "string" ||
      !config.socket.startsWith("/") ||
      typeof config.tokenFile !== "string"
    )
      throw new Error("Desktop configuration invalid");
  }
  const token = readFileSync(config.tokenFile, "utf8").trim();
  if (token.length < 64)
    throw new Error("Desktop authentication is not configured");
  return token;
}
const { allowed, notification } = require("./policy.cjs");
function trusted(event) {
  return (
    window &&
    event.sender === window.webContents &&
    event.senderFrame?.url === window.webContents.getURL() &&
    event.senderFrame?.url.startsWith("file:")
  );
}
function api(path, init = {}) {
  return new Promise((resolve, reject) => {
    const method = init.method || "GET";
    if (!allowed(path, method)) {
      reject(new Error("Unsupported monitor operation"));
      return;
    }
    let token;
    try {
      token = credentials();
    } catch (e) {
      reject(e);
      return;
    }
    const body = init.body === undefined ? null : JSON.stringify(init.body);
    if (body && body.length > 65536) {
      reject(new Error("Request too large"));
      return;
    }
    const req = request(
      {
        socketPath: config.socket,
        path: `/v1${path}`,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
          if (text.length > 2_000_000)
            req.destroy(new Error("Response too large"));
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(text);
            if (res.statusCode >= 400)
              reject(new Error(data.error || "Monitor request failed"));
            else resolve(data);
          } catch {
            reject(new Error("Monitor response invalid"));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () =>
      req.destroy(new Error("Monitor request timed out")),
    );
    req.end(body);
  });
}
function emit(kind, data) {
  if (window && !window.isDestroyed())
    window.webContents.send("monitor:event", { kind, data });
}
function notify(snapshot) {
  for (const i of snapshot.incidents) {
    const decision = notification(i, seen.get(i.id));
    if (decision.version) seen.set(i.id, decision.version);
    if (!decision.notify) continue;
    if (Notification.isSupported())
      new Notification({
        title:
          i.state === "resolved"
            ? "RePro · recovered"
            : `RePro · ${i.severity}`,
        body: i.title,
        silent: i.severity !== "critical",
      }).show();
  }
  for (const id of seen.keys())
    if (!snapshot.incidents.some((i) => i.id === id)) seen.delete(id);
  persistNotices();
}
function persistNotices() {
  try {
    const directory = app.getPath("userData");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, "monitor-notices.json");
    writeFileSync(path + ".tmp", JSON.stringify([...seen].slice(-250)), {
      mode: 0o600,
    });
    renameSync(path + ".tmp", path);
  } catch {
    /* Optional persistence. */
  }
}
function connect() {
  if (quit) return;
  let token;
  try {
    token = credentials();
  } catch (e) {
    emit("error", e.message);
    reconnect = setTimeout(connect, 5000);
    return;
  }
  stream = request(
    {
      socketPath: config.socket,
      path: "/v1/events",
      headers: { Authorization: `Bearer ${token}` },
    },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        emit("error", "Monitor connection denied");
        return;
      }
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.length > 2_000_000) {
          stream.destroy();
          return;
        }
        let n;
        while ((n = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, n);
          buffer = buffer.slice(n + 2);
          const event = frame
              .split("\n")
              .find((l) => l.startsWith("event: "))
              ?.slice(7),
            data = frame
              .split("\n")
              .find((l) => l.startsWith("data: "))
              ?.slice(6);
          try {
            if (data) {
              const parsed = JSON.parse(data);
              if (event === "snapshot") {
                latest = parsed;
                notify(parsed);
                tray?.setToolTip(
                  `RePro · ${parsed.incidents.filter((i) => i.state !== "resolved").length} active incidents`,
                );
              }
              emit(event, parsed);
            }
          } catch {
            emit("error", "Invalid monitor event");
          }
        }
      });
    },
  );
  stream.on("error", () =>
    emit("error", "Local monitoring service unavailable"),
  );
  stream.on("close", () => {
    if (!quit) reconnect = setTimeout(connect, 3000);
  });
  stream.end();
}
function open() {
  if (window && !window.isDestroyed()) {
    window.show();
    window.focus();
    return;
  }
  window = new BrowserWindow({
    width: 1420,
    height: 940,
    minWidth: 780,
    minHeight: 600,
    title: "RePro Server Monitor",
    backgroundColor: "#f5f8fa",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.on("close", (event) => {
    if (!quit) {
      event.preventDefault();
      window.hide();
    }
  });
  window.loadFile(
    join(__dirname, "renderer/packages/monitor-desktop/index.html"),
  );
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", open);
  app.whenReady().then(() => {
    try {
      const text = readFileSync(
        join(app.getPath("userData"), "monitor-notices.json"),
        "utf8",
      );
      if (text.length < 100000)
        for (const [id, value] of JSON.parse(text).slice(-250))
          seen.set(id, value);
    } catch {
      /* First run. */
    }
    const icon = nativeImage.createFromPath(join(__dirname, "icon.png"));
    tray = new Tray(icon);
    tray.setToolTip("RePro Server Monitor");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open monitor", click: open },
        {
          label: "Open RePro dashboard",
          click: () =>
            shell.openExternal(
              "https://reprodashboard.com/settings?tab=overview&view=server",
            ),
        },
        { type: "separator" },
        {
          label: "Quit desktop monitor",
          click: () => {
            quit = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on("click", open);
    ipcMain.handle("monitor:request", (event, path, init) => {
      if (!trusted(event)) throw new Error("Untrusted renderer");
      return api(path, init);
    });
    ipcMain.on("monitor:subscribe", (event) => {
      if (trusted(event) && latest) emit("snapshot", latest);
    });
    open();
    connect();
  });
  app.on("before-quit", () => {
    quit = true;
    clearTimeout(reconnect);
    stream?.destroy();
  });
  app.on("window-all-closed", () => {});
}
module.exports = { allowed };
