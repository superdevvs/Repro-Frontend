import { cp, mkdir, writeFile, chmod, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url),
  root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "artifact"),
  stage = resolve(output, `stage-${Date.now()}`),
  app = join(stage, "opt/repro-monitor-desktop");
await stat(join(root, "renderer/packages/monitor-desktop/index.html"));
await mkdir(app, { recursive: true });
await cp(dirname(require("electron")), app, { recursive: true });
await mkdir(join(app, "resources/app"), { recursive: true });
for (const file of [
  "main.cjs",
  "preload.cjs",
  "policy.cjs",
  "icon.png",
  "renderer",
])
  await cp(join(root, file), join(app, "resources/app", file), {
    recursive: true,
  });
await writeFile(
  join(app, "resources/app/package.json"),
  JSON.stringify({
    name: "repro-server-monitor",
    version: "1.0.0",
    main: "main.cjs",
  }),
);
await mkdir(join(stage, "DEBIAN"), { recursive: true });
await writeFile(
  join(stage, "DEBIAN/control"),
  "Package: repro-server-monitor\nVersion: 1.0.0\nSection: admin\nPriority: optional\nArchitecture: amd64\nMaintainer: RePro Operations\nDepends: libnss3, libatk-bridge2.0-0, libgtk-3-0, libgbm1, libasound2t64 | libasound2\nDescription: Read-only RePro desktop server monitoring and AI advice\n",
);
await mkdir(join(stage, "usr/share/applications"), { recursive: true });
await writeFile(
  join(stage, "usr/share/applications/repro-server-monitor.desktop"),
  "[Desktop Entry]\nType=Application\nName=RePro Server Monitor\nComment=Server health, logs, schedules and AI advice\nExec=/opt/repro-monitor-desktop/electron\nIcon=/opt/repro-monitor-desktop/resources/app/icon.png\nTerminal=false\nCategories=System;Monitor;\n",
);
await chmod(join(app, "chrome-sandbox"), 0o4755);
await mkdir(output, { recursive: true });
const deb = join(output, "repro-server-monitor_1.0.0_amd64.deb");
execFileSync("dpkg-deb", ["--root-owner-group", "--build", stage, deb], {
  stdio: "inherit",
});
console.log(deb);
