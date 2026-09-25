import { Worker } from "node:worker_threads";
import { stat } from "node:fs/promises";
import type { Metric, Queue, Usage } from "@repro/monitor-contracts";
export interface DatabaseResult {
  queues: Queue[];
  metrics: Metric[];
  usage: Usage[];
  missing: string[];
}
export async function database(path: string): Promise<DatabaseResult> {
  const result = await new Promise<DatabaseResult>((resolve, reject) => {
    const worker = new Worker(
      new URL("./database-worker.js", import.meta.url),
      { workerData: { path } },
    );
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Read-only database collection exceeded 1 second"));
    }, 1000);
    worker.once("message", (r) => {
      clearTimeout(timer);
      void worker.terminate();
      if (r.error) reject(new Error(r.error));
      else resolve(r);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      const s = await stat(path + suffix);
      result.metrics.push({
        key: `database${suffix || "_main"}_bytes`,
        label: `SQLite ${suffix || "database"}`,
        value: s.size,
        unit: "bytes",
        source: "database",
      });
    } catch {
      result.metrics.push({
        key: `database${suffix}_bytes`,
        label: `SQLite ${suffix}`,
        value: null,
        unit: "bytes",
        source: "database",
      });
    }
  }
  return result;
}
