import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonitorClient, Series } from "@repro/monitor-contracts";
export function MonitorChart({
  client,
  metric,
  title,
  hours,
  fixedTo,
}: {
  client: MonitorClient;
  metric: string;
  title: string;
  hours: number;
  fixedTo?: number;
}) {
  const [series, setSeries] = useState<Series | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let closed = false;
    const update = async () => {
      try {
        const to = fixedTo ?? Date.now() / 1000;
        const s = await client.request<Series>(
          `/history?key=${metric}&from=${Math.floor(to - hours * 3600)}&to=${Math.floor(to)}`,
        );
        if (!closed) {
          setSeries(s);
          setError("");
        }
      } catch {
        if (!closed) setError("Metrics history is unavailable");
      }
    };
    void update();
    const timer = setInterval(() => void update(), 15000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [client, metric, hours, fixedTo]);
  return (
    <article className="rm-panel">
      <div className="rm-panel-heading">
        <h2>{title}</h2>
        <span>{hours}h</span>
      </div>
      {error || !series?.points.length ? (
        <div className="rm-chart-empty">
          {error || "Waiting for recorded history"}
        </div>
      ) : (
        <div className="rm-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series.points.map(([timestamp, value]) => ({
                timestamp,
                value: metric === "memory_used" ? value / 1024 ** 3 : value,
              }))}
            >
              <defs>
                <linearGradient
                  id={`gradient-${metric}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0" stopColor="#16a68b" stopOpacity={0.25} />
                  <stop offset="1" stopColor="#16a68b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 5"
                vertical={false}
                stroke="var(--rm-line)"
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) =>
                  new Date(v).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                minTickGap={50}
                tick={{ fontSize: 11, fill: "var(--rm-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={42}
                tick={{ fontSize: 11, fill: "var(--rm-muted)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              <Tooltip
                labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                formatter={(v: number) => [
                  v.toFixed(2),
                  metric === "memory_used" ? "GiB" : title,
                ]}
                contentStyle={{
                  background: "var(--rm-surface)",
                  border: "1px solid var(--rm-line)",
                  borderRadius: 8,
                  color: "var(--rm-text)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#129a82"
                fill={`url(#gradient-${metric})`}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
