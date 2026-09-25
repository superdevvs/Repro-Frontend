import { request } from "node:http";
import { readFileSync } from "node:fs";
import type { ProviderConnection } from "@repro/monitor-contracts";
export class BrokerClient {
  private token: string;
  constructor(
    private socket: string,
    tokenFile: string,
  ) {
    this.token = readFileSync(tokenFile, "utf8").trim();
  }
  private async call(
    path: string,
    body?: unknown,
    onDelta?: (s: string) => void,
  ): Promise<unknown> {
    return await new Promise((resolve, reject) => {
      const req = request(
        {
          socketPath: this.socket,
          path,
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          timeout: body ? 125000 : 25000,
        },
        (res) => {
          let buffer = "",
            result: unknown;
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            buffer += chunk;
            if (buffer.length > 1_000_000) {
              req.destroy(new Error("Broker response too large"));
              return;
            }
            if (body) {
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                try {
                  const item = JSON.parse(line);
                  if (item.error) {
                    reject(new Error(item.error));
                    req.destroy();
                    return;
                  }
                  if (item.delta) onDelta?.(item.delta);
                  if (item.text !== undefined) result = item.text;
                } catch {
                  reject(new Error("Invalid broker frame"));
                  req.destroy();
                }
              }
            }
          });
          res.on("end", () => {
            if (res.statusCode !== 200) {
              reject(new Error(`AI broker returned ${res.statusCode}`));
              return;
            }
            try {
              resolve(body ? result : JSON.parse(buffer));
            } catch {
              reject(new Error("Invalid broker response"));
            }
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("AI broker timeout")));
      req.on("error", reject);
      req.end(body ? JSON.stringify(body) : undefined);
    });
  }
  async status(provider: "codex" | "grok-cli"): Promise<ProviderConnection> {
    return (await this.call(`/status/${provider}`)) as ProviderConnection;
  }
  async analyze(
    provider: "codex" | "grok-cli",
    prompt: string,
    model: string | null,
    onDelta: (s: string) => void,
  ): Promise<string> {
    const r = await this.call("/analyze", { provider, prompt, model }, onDelta);
    if (typeof r !== "string") throw new Error("AI broker stream incomplete");
    return r;
  }
}
