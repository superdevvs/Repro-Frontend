import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { browserMonitorClient, hasMonitorRole } from "./client";
/** One stream in the outer dashboard shell; never requests browser notification permission. */
export default function MonitorNotifications() {
  const { user, role, isImpersonating } = useAuth();
  const eligible =
    !isImpersonating &&
    hasMonitorRole(role || user?.role, user?.secondary_roles);
  useEffect(() => {
    if (!eligible || !user?.id) return;
    const storageKey = `repro-monitor-notices:${user.id}`;
    let seen: Record<string, string> = {};
    try {
      seen = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      /* Optional dedup state. */
    }
    return browserMonitorClient().subscribe(
      (snapshot) => {
        for (const i of snapshot.incidents) {
          if (i.snoozedUntil && Date.parse(i.snoozedUntil) > Date.now())
            continue;
          const version = `${i.severity}:${i.state}:${i.updatedAt}`,
            old = seen[i.id];
          seen[i.id] = version;
          if (
            old === version ||
            i.state === "acknowledged" ||
            (i.state === "resolved" && !old)
          )
            continue;
          toast(i.state === "resolved" ? `Recovered: ${i.title}` : i.title, {
            description: `Server monitor · ${i.severity}`,
            duration: i.severity === "critical" ? 15000 : 7000,
          });
        }
        seen = Object.fromEntries(Object.entries(seen).slice(-250));
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(seen));
        } catch {
          /* Monitoring does not require storage access. */
        }
      },
      () => {},
    );
  }, [eligible, user?.id]);
  return null;
}
