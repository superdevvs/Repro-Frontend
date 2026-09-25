import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
export const disabledFeatures = [
  "shell_tool",
  "unified_exec",
  "apps",
  "plugins",
  "hooks",
  "multi_agent",
  "multi_agent_v2",
  "browser_use",
  "browser_use_external",
  "computer_use",
  "in_app_browser",
  "image_generation",
  "skill_search",
  "skill_mcp_dependency_install",
  "code_mode",
  "code_mode_host",
  "remote_plugin",
  "goals",
];
export async function sandbox(
  state: string,
  provider: "codex" | "grok-cli",
  binary: string,
) {
  const root = resolve(state, provider);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(`${root}/workspace`, { recursive: true, mode: 0o700 });
  await mkdir(`${root}/home`, { recursive: true, mode: 0o700 });
  const auth = resolve(
    homedir(),
    provider === "codex" ? ".codex/auth.json" : ".grok/auth.json",
  );
  await access(auth);
  await access(binary);
  const args = [
    "--die-with-parent",
    "--new-session",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--ro-bind",
    "/usr",
    "/usr",
    "--ro-bind",
    "/lib",
    "/lib",
    "--ro-bind",
    "/lib64",
    "/lib64",
    "--ro-bind",
    "/bin",
    "/bin",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--dir",
    "/etc",
    "--ro-bind",
    "/etc/ssl",
    "/etc/ssl",
    "--ro-bind",
    "/etc/resolv.conf",
    "/etc/resolv.conf",
    "--ro-bind",
    "/etc/hosts",
    "/etc/hosts",
    "--ro-bind",
    "/etc/nsswitch.conf",
    "/etc/nsswitch.conf",
    "--dir",
    "/home",
    "--dir",
    "/home/monitor",
    "--bind",
    `${root}/home`,
    "/agent",
    "--ro-bind",
    auth,
    "/agent/auth.json",
    "--ro-bind",
    `${root}/workspace`,
    "/workspace",
    "--ro-bind",
    binary,
    "/repro-agent",
    "--chdir",
    "/workspace",
    "--setenv",
    "HOME",
    "/home/monitor",
    "--setenv",
    provider === "codex" ? "CODEX_HOME" : "GROK_HOME",
    "/agent",
    "--setenv",
    "PATH",
    "/usr/bin:/bin",
  ];
  if (provider === "codex") {
    await writeFile(
      `${root}/home/config.toml`,
      'approval_policy="never"\ndefault_permissions="monitor-readonly"\nweb_search="disabled"\n[permissions.monitor-readonly.filesystem]\n":root"="deny"\n":minimal"="read"\n"/workspace"="read"\n"/agent"="deny"\n[permissions.monitor-readonly.network]\nenabled=false\n[features]\n' +
        disabledFeatures.map((f) => `${f}=false`).join("\n") +
        "\n",
      { mode: 0o600 },
    );
  } else {
    await writeFile(
      `${root}/home/config.toml`,
      '[permissions]\ndefault_mode="plan"\n',
      { mode: 0o600 },
    );
  }
  return {
    args,
    root,
    env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", HOME: homedir() },
  };
}
