import { history, logs } from "../history.js";
import type { Config } from "../config.js";
import { redactText } from "../privacy.js";
export async function evidence(cfg: Config) {
  const to = Math.floor(Date.now() / 1000),
    from = to - 900;
  const results = await Promise.allSettled([
    history(cfg.prometheusUrl, "cpu_percent", from, to),
    history(cfg.prometheusUrl, "request_p95", from, to),
    history(cfg.prometheusUrl, "error_percent", from, to),
    logs(cfg.lokiUrl, "all", "", from, to),
  ]);
  return {
    from: new Date(from * 1000).toISOString(),
    to: new Date(to * 1000).toISOString(),
    history: results.slice(0, 3).map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            source: ["cpu_percent", "request_p95", "error_percent"][i],
            status: "unavailable",
          },
    ),
    logs:
      results[3].status === "fulfilled"
        ? (results[3].value as Awaited<ReturnType<typeof logs>>)
            .filter((e) => e.level === "error")
            .slice(0, 15)
            .map((e) => ({
              ...e,
              message: redactText(e.message).slice(0, 700),
            }))
        : [{ status: "unavailable" }],
  };
}
