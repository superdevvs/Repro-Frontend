import React, { Profiler } from "react";

const isProfilerLoggingEnabled = () => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const flag = window.localStorage.getItem("repro.debug.profiler");
    if (flag === "1" || flag === "true") {
      return true;
    }
  } catch {
    return false;
  }
  return (window as Window & { __REPRO_DEBUG_PROFILER__?: boolean })
    .__REPRO_DEBUG_PROFILER__ === true;
};

const logDashboardProfiler: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!isProfilerLoggingEnabled()) return;
  console.debug(`[Profiler:${id}]`, {
    phase,
    actualDuration: Number(actualDuration.toFixed(2)),
    baseDuration: Number(baseDuration.toFixed(2)),
    startTime: Number(startTime.toFixed(2)),
    commitTime: Number(commitTime.toFixed(2)),
  });
};

export const DevProfiler: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) =>
  import.meta.env.DEV ? (
    <Profiler id={id} onRender={logDashboardProfiler}>
      {children}
    </Profiler>
  ) : (
    <>{children}</>
  );
