import { readFile, readdir, statfs } from "node:fs/promises";
import { cpus, hostname, loadavg, uptime } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Coverage, Disk, Metric, Service } from "@repro/monitor-contracts";
import type { Config } from "../config.js";
import { redactText } from "../privacy.js";
const exec = promisify(execFile);
export async function command(
  file: string,
  args: string[],
  timeout = 1500,
): Promise<string> {
  const r = await exec(file, args, {
    timeout,
    maxBuffer: 1024 * 1024,
    env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" },
  });
  return r.stdout;
}
const reading = (
  key: string,
  label: string,
  value: number | null,
  unit: string,
  source = "host",
): Metric => ({ key, label, value, unit, source });
export class HostCollector {
  previousCpu: number[] = [];
  previousIo = new Map<string, number[]>();
  previousNet = new Map<string, number[]>();
  previousAt = Date.now();
  async collect(): Promise<{ metrics: Metric[]; sources: Coverage[] }> {
    const now = Date.now(),
      elapsed = Math.max((now - this.previousAt) / 1000, 0.001);
    const observedAt = new Date(now).toISOString();
    const metrics: Metric[] = [];
    const [stat, mem, net, io] = await Promise.all(
      ["stat", "meminfo", "net/dev", "diskstats"].map((f) =>
        readFile(`/proc/${f}`, "utf8"),
      ),
    );
    const cpu = stat.split("\n")[0].trim().split(/\s+/).slice(1, 9).map(Number);
    const delta = cpu.map((v, i) => v - (this.previousCpu[i] ?? v));
    const total = delta.reduce((a, b) => a + b, 0);
    metrics.push(
      reading(
        "cpu_percent",
        "CPU usage",
        total ? 100 * (1 - (delta[3] + delta[4]) / total) : null,
        "%",
      ),
    );
    metrics.push(
      reading("load_1", "Load (1 minute)", loadavg()[0], "load"),
      reading("cpu_count", "Logical CPUs", cpus().length, "count"),
      reading("uptime", "Uptime", uptime(), "seconds"),
    );
    const m = Object.fromEntries(
      mem
        .trim()
        .split("\n")
        .map((line) => {
          const [k, v] = line.split(/:\s*/);
          return [k, Number.parseInt(v) * 1024];
        }),
    );
    metrics.push(
      reading(
        "memory_used",
        "Memory used",
        m.MemTotal - m.MemAvailable,
        "bytes",
      ),
      reading("memory_total", "Memory total", m.MemTotal, "bytes"),
      reading(
        "memory_available_percent",
        "Memory available",
        (100 * m.MemAvailable) / m.MemTotal,
        "%",
      ),
      reading("swap_used", "Swap used", m.SwapTotal - m.SwapFree, "bytes"),
    );
    for (const line of net.split("\n").slice(2)) {
      const [nic, values] = line.trim().split(":");
      if (!values || nic === "lo") continue;
      const v = values.trim().split(/\s+/).map(Number),
        old = this.previousNet.get(nic);
      metrics.push(
        reading(
          `network_rx_${nic}`,
          `${nic} receive`,
          old ? (v[0] - old[0]) / elapsed : null,
          "bytes/s",
        ),
        reading(
          `network_tx_${nic}`,
          `${nic} send`,
          old ? (v[8] - old[8]) / elapsed : null,
          "bytes/s",
        ),
      );
      this.previousNet.set(nic, v);
    }
    for (const line of io.trim().split("\n")) {
      const v = line.trim().split(/\s+/),
        name = v[2];
      if (!/^(sd[a-z]+|nvme\d+n\d+)$/.test(name)) continue;
      const n = v.slice(3).map(Number),
        old = this.previousIo.get(name);
      if (old) {
        const ops = n[0] - old[0] + n[4] - old[4];
        metrics.push(
          reading(
            `disk_read_${name}`,
            `${name} read`,
            (512 * (n[2] - old[2])) / elapsed,
            "bytes/s",
            "storage",
          ),
          reading(
            `disk_write_${name}`,
            `${name} write`,
            (512 * (n[6] - old[6])) / elapsed,
            "bytes/s",
            "storage",
          ),
          reading(
            `disk_await_${name}`,
            `${name} I/O latency`,
            ops ? (n[3] - old[3] + n[7] - old[7]) / ops : 0,
            "ms",
            "storage",
          ),
          reading(
            `disk_util_${name}`,
            `${name} I/O utilization`,
            Math.min(100, (n[9] - old[9]) / (elapsed * 10)),
            "%",
            "storage",
          ),
        );
      }
      this.previousIo.set(name, n);
    }
    for (const kind of ["cpu", "memory", "io"]) {
      try {
        const p = await readFile(`/proc/pressure/${kind}`, "utf8");
        const match = p.match(/some avg10=([\d.]+)/);
        metrics.push(
          reading(
            `pressure_${kind}`,
            `${kind} pressure`,
            match ? Number(match[1]) : null,
            "%",
          ),
        );
      } catch {
        metrics.push(
          reading(`pressure_${kind}`, `${kind} pressure`, null, "%"),
        );
      }
    }
    this.previousCpu = cpu;
    this.previousAt = now;
    return {
      metrics,
      sources: [
        {
          id: "host",
          label: hostname(),
          status: "healthy",
          observedAt,
          intervalMs: 5000,
        },
      ],
    };
  }
}
export async function disks(cfg: Config): Promise<Disk[]> {
  const inventory = JSON.parse(
    await command("/usr/bin/findmnt", [
      "--json",
      "--list",
      "--output",
      "TARGET,SOURCE,UUID,FSTYPE",
    ]),
  );
  const mounts = inventory.filesystems as {
    target: string;
    source: string;
    uuid: string | null;
    fstype: string;
  }[];
  const wanted = ["/", "/mnt/16tb", "/media/maverick/Expansion"];
  const result: Disk[] = [];
  for (const mount of wanted) {
    const actual = mounts.find((m) => m.target === mount);
    if (!actual) {
      result.push({
        id: mount,
        mount,
        device: "unmounted",
        uuid: null,
        bytes: 0,
        free: 0,
        inodesFree: null,
        expected: mount !== "/media/maverick/Expansion",
        valid: false,
      });
      continue;
    }
    const stat = await statfs(mount);
    result.push({
      id: mount,
      mount,
      device: actual.source,
      uuid: actual.uuid,
      bytes: stat.blocks * stat.bsize,
      free: stat.bavail * stat.bsize,
      inodesFree: stat.ffree,
      expected: mount !== "/media/maverick/Expansion",
      valid: mount !== "/mnt/16tb" || actual.uuid === cfg.expectedMediaUuid,
    });
  }
  return result;
}
export async function services(): Promise<Service[]> {
  const names = [
    "nginx",
    "php8.3-fpm",
    "supervisor",
    "cron",
    "clamav-daemon",
    "mysql",
    "repro-monitor",
    "repro-prometheus",
    "repro-loki",
    "repro-alloy",
  ];
  const text = await command("/usr/bin/systemctl", [
    "show",
    ...names.map((n) => `${n}.service`),
    "--property=Id,ActiveState,SubState,MainPID,NRestarts",
    "--no-pager",
  ]);
  return text
    .trim()
    .split("\n\n")
    .map((block) => {
      const p = Object.fromEntries(
        block.split("\n").map((s) => {
          const i = s.indexOf("=");
          return [s.slice(0, i), s.slice(i + 1)];
        }),
      );
      return {
        id: p.Id,
        name: p.Id,
        state: p.ActiveState,
        detail: p.SubState,
        pid: Number(p.MainPID),
        restarts: Number(p.NRestarts),
      };
    });
}
let previousProcesses = new Map<string, { ticks: number; start: string }>(),
  previousProcessAt = Date.now();
export async function processes(): Promise<Metric[]> {
  const now = Date.now(),
    elapsed = Math.max((now - previousProcessAt) / 1000, 0.001);
  const current = new Map<string, { ticks: number; start: string }>();
  const entries = (await readdir("/proc"))
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 4096);
  const rows = await Promise.all(
    entries.map(async (pid) => {
      try {
        const s = await readFile(`/proc/${pid}/stat`, "utf8");
        const end = s.lastIndexOf(")");
        const fields = s.slice(end + 2).split(" ");
        const ticks = Number(fields[11]) + Number(fields[12]),
          start = fields[19],
          previous = previousProcesses.get(pid);
        current.set(pid, { ticks, start });
        return {
          cpu:
            previous && previous.start === start
              ? Math.max(0, ticks - previous.ticks) / elapsed
              : null,
          name: s.slice(s.indexOf("(") + 1, end),
          rss: Number(fields[21]) * 4096,
        };
      } catch {
        return null;
      }
    }),
  );
  previousProcesses = current;
  previousProcessAt = now;
  const grouped = new Map<string, number>(),
    cpu = new Map<string, number>();
  for (const p of rows)
    if (p) grouped.set(p.name, (grouped.get(p.name) ?? 0) + p.rss);
  const memory = [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, value]) =>
      reading(`process_${name}`, name, value, "bytes", "processes"),
    );
  for (const p of rows)
    if (p && p.cpu !== null) cpu.set(p.name, (cpu.get(p.name) ?? 0) + p.cpu);
  return [
    ...memory,
    ...[...cpu.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, value]) =>
        reading(
          `process_cpu_${name}`,
          name + " CPU (100% = one core)",
          value,
          "%",
          "processes",
        ),
      ),
  ];
}
export async function sensors(): Promise<{
  metrics: Metric[];
  sources: Coverage[];
}> {
  const metrics: Metric[] = [],
    sources: Coverage[] = [];
  const observedAt = new Date().toISOString();
  for (const chip of await readdir("/sys/class/hwmon").catch(() => [])) {
    for (const file of await readdir(`/sys/class/hwmon/${chip}`).catch(
      () => [],
    )) {
      if (!/^temp\d+_input$/.test(file)) continue;
      try {
        metrics.push(
          reading(
            `${chip}_${file}`,
            `${chip} ${file.replace("_input", "")}`,
            Number(await readFile(`/sys/class/hwmon/${chip}/${file}`, "utf8")) /
              1000,
            "°C",
            "temperature",
          ),
        );
      } catch {
        /* Missing sensor remains represented by coverage. */
      }
    }
  }
  sources.push({
    id: "temperature",
    label: "Hardware temperatures",
    status: metrics.length ? "healthy" : "unavailable",
    observedAt,
    intervalMs: 300000,
    detail: metrics.length ? undefined : "No readable temperature sensors",
  });
  try {
    const out = await command("/usr/bin/nvidia-smi", [
      "--query-gpu=utilization.gpu,memory.used,temperature.gpu",
      "--format=csv,noheader,nounits",
    ]);
    out
      .trim()
      .split("\n")
      .forEach((line, i) => {
        const v = line.split(",").map(Number);
        metrics.push(
          reading(`gpu_${i}_usage`, `GPU ${i} usage`, v[0], "%", "gpu"),
          reading(
            `gpu_${i}_memory`,
            `GPU ${i} memory`,
            v[1] * 1048576,
            "bytes",
            "gpu",
          ),
          reading(`gpu_${i}_temp`, `GPU ${i} temperature`, v[2], "°C", "gpu"),
        );
      });
    sources.push({
      id: "gpu",
      label: "NVIDIA GPU",
      status: "healthy",
      observedAt,
      intervalMs: 300000,
    });
  } catch (e) {
    sources.push({
      id: "gpu",
      label: "NVIDIA GPU",
      status: "unavailable",
      observedAt,
      intervalMs: 300000,
      detail: redactText(
        [
          e instanceof Error ? e.message : "GPU unavailable",
          (e as { stdout?: string }).stdout ?? "",
          (e as { stderr?: string }).stderr ?? "",
        ].join("\n"),
      ).slice(0, 700),
    });
  }
  return { metrics, sources };
}
