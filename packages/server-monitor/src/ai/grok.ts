import type { ProviderConnection } from "@repro/monitor-contracts";
import { Rpc } from "./rpc.js";
import { sandbox } from "./sandbox.js";
import { instruction } from "./codex.js";
export class GrokCli {
  constructor(
    private state: string,
    private binary: string,
  ) {}
  private async open() {
    const s = await sandbox(this.state, "grok-cli", this.binary);
    const rpc = new Rpc(
      "/usr/bin/bwrap",
      [
        ...s.args,
        "/repro-agent",
        "--no-auto-update",
        "--sandbox",
        "read-only",
        "--tools",
        "",
        "--no-subagents",
        "--no-memory",
        "--disable-web-search",
        "agent",
        "stdio",
      ],
      s.env,
    );
    try {
      const init = await rpc.call<{ authMethods: { id: string }[] }>(
        "initialize",
        {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
        },
      );
      if (!init.authMethods.some((a) => a.id === "cached_token"))
        throw new Error("Run grok login --device-auth first");
      await rpc.call("authenticate", {
        methodId: "cached_token",
        _meta: { headless: true },
      });
      return rpc;
    } catch (e) {
      rpc.close();
      throw e;
    }
  }
  async status(): Promise<ProviderConnection> {
    const rpc = await this.open();
    try {
      const r = await rpc.call<{
        models?: {
          availableModels: { modelId: string }[];
          currentModelId: string;
        };
      }>("session/new", { cwd: "/workspace", mcpServers: [] });
      return {
        id: "grok-cli",
        label: "Grok CLI · account login",
        connected: true,
        status: "Connected · isolated read-only session",
        models: r.models?.availableModels.map((m) => m.modelId) ?? [],
        selectedModel: r.models?.currentModelId ?? null,
        owner: "operator",
      };
    } finally {
      rpc.close();
    }
  }
  async analyze(
    prompt: string,
    model: string | null,
    onDelta: (s: string) => void,
  ): Promise<string> {
    const rpc = await this.open();
    try {
      const s = await rpc.call<{ sessionId: string }>("session/new", {
        cwd: "/workspace",
        mcpServers: [],
      });
      if (model)
        await rpc.call("session/set_model", {
          sessionId: s.sessionId,
          modelId: model,
        });
      let text = "";
      rpc.listeners.add((m) => {
        if (
          m.method !== "session/update" ||
          m.params?.sessionId !== s.sessionId
        )
          return;
        const u = m.params.update as {
          sessionUpdate: string;
          content?: { text?: string };
        };
        if (u.sessionUpdate === "tool_call") {
          rpc.close();
          return;
        }
        if (u.sessionUpdate === "agent_message_chunk" && u.content?.text) {
          if (text.length + u.content.text.length > 24000) {
            rpc.close();
            return;
          }
          text += u.content.text;
          onDelta(u.content.text);
        }
      });
      const r = await rpc.call<{ stopReason: string }>(
        "session/prompt",
        {
          sessionId: s.sessionId,
          prompt: [{ type: "text", text: instruction + "\n\n" + prompt }],
        },
        120000,
      );
      if (r.stopReason !== "end_turn")
        throw new Error("Grok did not complete the analysis");
      return text;
    } finally {
      rpc.close();
    }
  }
}
