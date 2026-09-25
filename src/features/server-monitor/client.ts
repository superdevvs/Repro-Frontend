import { apiClient } from "@/services/api";
import type { MonitorClient, Snapshot } from "@repro/monitor-contracts";
export function browserMonitorClient(): MonitorClient {
  let session: {
    token: string;
    expiresAt: string;
    gatewayPath: string;
  } | null = null;
  let pending: Promise<void> | null = null;
  async function ticket() {
    if (session && Date.parse(session.expiresAt) > Date.now() + 10000)
      return session;
    if (!pending)
      pending = apiClient
        .post("/admin/system-overview/server/session")
        .then(({ data }) => {
          if (data.gatewayPath !== "/server-monitor/v1")
            throw new Error("Invalid monitor endpoint");
          session = data;
        })
        .finally(() => {
          pending = null;
        });
    await pending;
    return session!;
  }
  return {
    async request<T>(
      path: string,
      init: { method?: string; body?: unknown } = {},
    ) {
      const s = await ticket();
      const response = await fetch(`${s.gatewayPath}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${s.token}`,
          "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        if (response.status === 401) session = null;
        const error = await response
          .json()
          .catch(() => ({ error: "Monitor unavailable" }));
        throw new Error(error.error ?? "Monitor request failed");
      }
      return (await response.json()) as T;
    },
    subscribe(onSnapshot, onError, onAi) {
      let closed = false;
      let delay = 2000;
      let controller: AbortController | null = null;
      let retry: ReturnType<typeof setTimeout> | null = null;
      const connect = async () => {
        controller = new AbortController();
        try {
          const s = await ticket();
          if (closed) return;
          const r = await fetch(`${s.gatewayPath}/events`, {
            headers: { Authorization: `Bearer ${s.token}` },
            signal: controller.signal,
            redirect: "error",
          });
          if (!r.ok || !r.body)
            throw new Error("Live monitoring connection unavailable");
          const reader = r.body.getReader(),
            decoder = new TextDecoder();
          let buffer = "";
          while (!closed) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > 2_000_000)
              throw new Error("Monitor frame too large");
            let boundary: number;
            while ((boundary = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const event = frame
                .split("\n")
                .find((l) => l.startsWith("event: "))
                ?.slice(7);
              const data = frame
                .split("\n")
                .find((l) => l.startsWith("data: "))
                ?.slice(6);
              if (!data) continue;
              if (event === "snapshot") {
                delay = 2000;
                onSnapshot(JSON.parse(data) as Snapshot);
              }
              if (event === "ai") onAi?.(JSON.parse(data));
              if (event === "expired") session = null;
            }
          }
        } catch (e) {
          if (!closed) onError(e instanceof Error ? e.message : "Disconnected");
        } finally {
          if (!closed) {
            retry = setTimeout(() => void connect(), delay);
            delay = Math.min(60000, delay * 2);
          }
        }
      };
      void connect();
      return () => {
        closed = true;
        controller?.abort();
        if (retry) clearTimeout(retry);
      };
    },
  };
}
export function hasMonitorRole(primary?: string, secondary?: string[]) {
  return [primary, ...(secondary ?? [])].some(
    (r) =>
      String(r ?? "")
        .replace(/[_-]/g, "")
        .toLowerCase() === "superadmin",
  );
}
