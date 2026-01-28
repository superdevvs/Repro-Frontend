import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { ReproAiIcon } from "@/components/icons/ReproAiIcon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { AiChatRequest } from "@/types/ai";

type InsightPriority = "blocking" | "attention" | "insight" | "assistive";

interface RobbieInsight {
  id: string;
  priority: InsightPriority;
  message: string;
  prompt: string;
  intent?: string;
  action?: string;
  insightType?: string;
  entity?: string;
  filters?: Record<string, any>;
}

interface RobbieInsightStripProps {
  role?: UserRole;
  className?: string;
}

const ROTATION_MIN_MS = 3000;
const ROTATION_MAX_MS = 5000;

const priorityMeta: Record<InsightPriority, { label: string; badgeClass: string; dotClass: string }> = {
  blocking: {
    label: "Blocking",
    badgeClass:
      "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
    dotClass: "bg-rose-500",
  },
  attention: {
    label: "Needs attention",
    badgeClass:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
    dotClass: "bg-amber-500",
  },
  insight: {
    label: "Insight",
    badgeClass:
      "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
    dotClass: "bg-sky-500",
  },
  assistive: {
    label: "Assist",
    badgeClass:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
  },
};

const allowedRoles: UserRole[] = ["admin", "superadmin", "salesRep", "client", "photographer", "editor"];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const REFRESH_INTERVAL_MS = 60000; // Auto-refresh every 60 seconds

const getRotationDelay = () =>
  ROTATION_MIN_MS + Math.floor(Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS + 1));

export const RobbieInsightStrip: React.FC<RobbieInsightStripProps> = ({ role, className }) => {
  const { role: authRole, session } = useAuth();
  const token = session?.accessToken;
  const navigate = useNavigate();
  const activeRole = role ?? authRole;
  const isAllowedRole = Boolean(activeRole && allowedRoles.includes(activeRole));
  const roleKey = (activeRole === "superadmin" ? "admin" : activeRole) ?? "admin";

  const [apiInsights, setApiInsights] = useState<RobbieInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch insights from API
  const fetchInsights = useCallback(async () => {
    if (!isAllowedRole || !token) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/robbie/insights`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        setApiInsights([]);
        setError('Unable to load insights right now.');
        return;
      }

      const data = await response.json();
      if (data?.success && Array.isArray(data.insights)) {
        setApiInsights(data.insights);
      } else {
        setApiInsights([]);
      }
    } catch (error) {
      console.error('Failed to fetch Robbie insights:', error);
      setApiInsights([]);
      setError('Unable to load insights right now.');
    } finally {
      setIsLoading(false);
    }
  }, [isAllowedRole, token]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  // Use API insights only (no static fallback)
  const insights = useMemo(() => {
    if (!isAllowedRole) return [];
    const blockingInsights = apiInsights.filter((insight) => insight.priority === "blocking");
    return (blockingInsights.length ? blockingInsights : apiInsights).slice(0, 5);
  }, [isAllowedRole, roleKey, apiInsights]);

  useEffect(() => {
    setActiveIndex(0);
  }, [roleKey, insights.length]);

  useEffect(() => {
    if (isPaused || insights.length <= 1) return;

    const timeout = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % insights.length);
    }, getRotationDelay());

    return () => window.clearTimeout(timeout);
  }, [activeIndex, insights.length, isPaused]);

  const activeInsight = insights[activeIndex];
  if (!isAllowedRole) return null;

  const placeholderMessage = isLoading
    ? "Loading Robbie insights..."
    : error
    ? error
    : "No insights yet — ask me anything.";

  const displayInsight: RobbieInsight = activeInsight ?? {
    id: "robbie-placeholder",
    priority: "assistive",
    message: placeholderMessage,
    prompt: "",
    action: "",
  };

  const meta = priorityMeta[displayInsight.priority];
  const isInteractive = Boolean(activeInsight && activeInsight.prompt);

  const handleOpenChat = () => {
    if (!activeInsight || !activeInsight.prompt) {
      if (error) {
        fetchInsights();
      }
      return;
    }
    const context: AiChatRequest["context"] = {
      mode: "insight",
      intent: activeInsight.intent,
      source: "robbie_insight_strip",
      insightId: activeInsight.id,
      insightType: activeInsight.insightType,
      entity: activeInsight.entity,
      filters: activeInsight.filters,
      insightPriority: activeInsight.priority,
      insightSummary: activeInsight.message,
      insightAction: activeInsight.action,
      role: roleKey,
    };

    navigate("/chat-with-reproai", {
      state: {
        initialMessage: activeInsight.prompt,
        context,
        source: "robbie_insight_strip",
      },
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Robbie insight: ${displayInsight.message}`}
      onClick={handleOpenChat}
      onKeyDown={(event) => {
        if (!isInteractive && !error) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenChat();
        }
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-background via-muted/20 to-background px-4 py-3 shadow-sm transition hover:border-border/80",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <ReproAiIcon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Robbie
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 flex items-center gap-2">
        <Badge
          className={cn("shrink-0 border px-1.5 py-0.5", meta.badgeClass)}
          title={meta.label}
          aria-label={meta.label}
        >
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", meta.dotClass)} />
        </Badge>
        <AnimatePresence mode="wait">
          <motion.div
            key={displayInsight.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="min-w-0 text-sm font-medium text-foreground/90 truncate"
            title={displayInsight.message}
          >
            {displayInsight.message}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:flex">
        <span>View details</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
};
