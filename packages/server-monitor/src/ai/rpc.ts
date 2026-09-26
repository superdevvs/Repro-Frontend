import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { redactText } from "../privacy.js";
export type RpcMessage = {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
};
export class Rpc {
  child: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private failure: string | null = null;
  private stderr = "";
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  listeners = new Set<(m: RpcMessage) => void>();
  constructor(file: string, args: string[], env: NodeJS.ProcessEnv) {
    this.child = spawn(file, args, { stdio: "pipe", env });
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      if (line.length > 1_000_000) {
        this.close();
        return;
      }
      try {
        const m = JSON.parse(line) as RpcMessage;
        if (m.id !== undefined && !m.method) {
          const p = this.pending.get(Number(m.id));
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(Number(m.id));
            if (m.error)
              p.reject(new Error(m.error.message ?? "Provider error"));
            else p.resolve(m.result);
          }
        } else if (m.id !== undefined && m.method) {
          this.write(
            JSON.stringify({
              id: m.id,
              jsonrpc: "2.0",
              error: {
                code: -32601,
                message:
                  "Interactive permissions and mutation tools are disabled",
              },
            }) + "\n",
          );
        } else for (const listener of this.listeners) listener(m);
      } catch {
        /* Non-protocol output is not forwarded. */
      }
    });
    this.child.stderr.on("data", (chunk: Buffer) => {
      if (this.stderr.length < 8192)
        this.stderr += chunk.toString().slice(0, 8192 - this.stderr.length);
    });
    this.child.stdin.on("error", (error: NodeJS.ErrnoException) =>
      this.fail(this.diagnostic(`Provider input unavailable (${error.code ?? "unknown"})`)));
    this.child.on("error", (error: NodeJS.ErrnoException) =>
      this.fail(this.diagnostic(`Provider process unavailable (${error.code ?? "unknown"})`)));
    this.child.on("close", (code, signal) =>
      this.fail(this.diagnostic(`Provider process exited (${signal ?? code ?? "unknown"})`)));
  }
  call<T = unknown>(
    method: string,
    params: unknown,
    timeout = 20000,
  ): Promise<T> {
    if (this.failure) return Promise.reject(new Error(this.failure));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Provider timed out: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
      this.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
      );
    });
  }
  notify(method: string, params: unknown = {}) {
    this.write(
      JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n",
    );
  }
  private diagnostic(message: string) {
    const detail = redactText(this.stderr).trim().slice(0, 1000);
    return detail ? `${message}: ${detail}` : message;
  }
  private write(data: string) {
    if (this.failure) return;
    try {
      this.child.stdin.write(data, (error) => {
        if (error) this.fail(this.diagnostic("Provider input closed"));
      });
    } catch {
      this.fail(this.diagnostic("Provider input closed"));
    }
  }
  private fail(message: string) {
    if (this.failure) return;
    this.failure = message;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    this.pending.clear();
  }
  close() {
    this.fail("Provider connection closed");
    this.child.kill("SIGTERM");
    setTimeout(() => {
      if (this.child.exitCode === null) this.child.kill("SIGKILL");
    }, 1000).unref();
  }
}
