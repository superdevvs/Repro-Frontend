import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import type { DashboardShootSummary, DashboardWorkflow } from "@/types/dashboard";
import { getAuthToken } from "@/utils/authToken";

import { buildPipelineWorkflow, type PipelineFilter } from "../pipelineWorkflow";
import { WORKFLOW_SEQUENCE } from "../constants";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface UseWorkflowPipelineParams {
  accessToken?: string | null;
  allSummaries?: DashboardShootSummary[];
  refresh: () => void | Promise<void>;
  toast: ToastFn;
  workflow?: DashboardWorkflow | null;
}

export const useWorkflowPipeline = ({
  accessToken,
  allSummaries = [],
  refresh,
  toast,
  workflow,
}: UseWorkflowPipelineParams) => {
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("this_week");

  const filteredWorkflow = useMemo(
    () => buildPipelineWorkflow(workflow, allSummaries),
    [allSummaries, workflow],
  );

  // Latest ready/delivered jobs for the side card — not constrained by the pipeline date chips.
  const deliveredShoots = useMemo(() => {
    if (!filteredWorkflow || !Array.isArray(filteredWorkflow.columns)) return [];
    return filteredWorkflow.columns
      .filter((column) => {
        const key = column.key.toLowerCase();
        return key.includes("ready") || key.includes("deliver") || key.includes("verified");
      })
      .flatMap((column) => (Array.isArray(column.shoots) ? column.shoots : []))
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [filteredWorkflow]);

  const handleAdvanceStage = useCallback(
    async (shoot: DashboardShootSummary) => {
      const token = getAuthToken(accessToken);
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in again to update workflow status.",
          variant: "destructive",
        });
        return;
      }

      const current = shoot.workflowStatus || "booked";
      const index = WORKFLOW_SEQUENCE.indexOf(current as (typeof WORKFLOW_SEQUENCE)[number]);
      if (index === -1 || index === WORKFLOW_SEQUENCE.length - 1) {
        toast({
          title: "Already at final stage",
          description: "This shoot cannot be advanced further.",
        });
        return;
      }

      const next = WORKFLOW_SEQUENCE[index + 1];

      try {
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workflow_status: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to update workflow status");
        toast({
          title: "Workflow advanced",
          description: `Shoot moved to ${next.replace("_", " ")}.`,
        });
        refresh();
      } catch (err) {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [accessToken, refresh, toast],
  );

  // Handle pipeline move back
  const handleMoveBack = useCallback(
    async (shoot: DashboardShootSummary) => {
      const token = getAuthToken(accessToken);
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in again to update workflow status.",
          variant: "destructive",
        });
        return;
      }

      const current = shoot.workflowStatus || "booked";
      const index = WORKFLOW_SEQUENCE.indexOf(current as (typeof WORKFLOW_SEQUENCE)[number]);
      if (index <= 0) {
        toast({
          title: "Already at first stage",
          description: "This shoot cannot be moved back further.",
        });
        return;
      }

      const prev = WORKFLOW_SEQUENCE[index - 1];

      try {
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workflow_status: prev }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to update workflow status");
        toast({
          title: "Workflow moved back",
          description: `Shoot moved to ${prev.replace("_", " ")}.`,
        });
        refresh();
      } catch (err) {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [accessToken, refresh, toast],
  );

  // Listen for pipeline:move-back custom event
  useEffect(() => {
    const handler = (e: CustomEvent<DashboardShootSummary>) => {
      handleMoveBack(e.detail);
    };
    window.addEventListener("pipeline:move-back", handler as EventListener);
    return () => window.removeEventListener("pipeline:move-back", handler as EventListener);
  }, [handleMoveBack]);

  return {
    deliveredShoots,
    filteredWorkflow,
    handleAdvanceStage,
    handleMoveBack,
    pipelineFilter,
    setPipelineFilter,
  };
};
