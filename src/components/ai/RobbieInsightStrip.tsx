import React, { useEffect, useMemo, useState } from "react";
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

const insightsByRole: Record<"admin" | "salesRep" | "client", RobbieInsight[]> = {
  admin: [
    {
      id: "admin-block-1",
      priority: "blocking",
      message: "4 shoots risk missing today's delivery SLA - two edits are overdue.",
      prompt: "Review the delivery SLA risk for today's shoots and recommend the fastest recovery plan.",
      intent: "manage_booking",
      action: "Open recovery plan",
    },
    {
      id: "admin-attention-1",
      priority: "attention",
      message: "Tomorrow is at 92% photographer capacity in Rockville.",
      prompt: "Check tomorrow's Rockville coverage and suggest how to rebalance the schedule.",
      intent: "availability",
      action: "Review coverage",
    },
    {
      id: "admin-insight-1",
      priority: "insight",
      message: "HDR shoots in MD are taking 22% longer on average this week.",
      prompt: "Analyze why HDR shoots are slower in MD and suggest operational improvements.",
      intent: "client_stats",
      action: "See trend",
    },
    {
      id: "admin-assist-1",
      priority: "assistive",
      message: "I can rebalance photographers for tomorrow to reduce overbooking.",
      prompt: "Draft a recommended reassignment plan for tomorrow’s photographers.",
      intent: "availability",
      action: "Rebalance coverage",
    },
  ],
  salesRep: [
    {
      id: "rep-block-1",
      priority: "blocking",
      message: "A client has been waiting on a response for 42 minutes.",
      prompt: "Draft a quick reply to the client who has been waiting for 42 minutes.",
      action: "Draft reply",
    },
    {
      id: "rep-attention-1",
      priority: "attention",
      message: "Shoot #619 may need rescheduling due to weather risk.",
      prompt: "Review Shoot #619 and suggest rescheduling options if weather worsens.",
      intent: "manage_booking",
      action: "Review options",
    },
    {
      id: "rep-insight-1",
      priority: "insight",
      message: "This client typically approves edits within 1 reminder.",
      prompt: "Recommend the best timing and tone for a reminder to this client.",
      action: "See guidance",
    },
    {
      id: "rep-assist-1",
      priority: "assistive",
      message: "Want me to notify the editor and track the ETA?",
      prompt: "Notify the editor and summarize the ETA expectations for this delivery.",
      action: "Notify editor",
    },
  ],
  client: [
    {
      id: "client-block-1",
      priority: "blocking",
      message: "Payment is required to release delivery for your last shoot.",
      prompt: "Explain the payment needed to release my delivery and the next steps.",
      intent: "accounting",
      action: "View payment",
    },
    {
      id: "client-attention-1",
      priority: "attention",
      message: "Your approval is needed to continue editing on your latest shoot.",
      prompt: "Walk me through the approval I need to submit so editing can continue.",
      action: "Review approval",
    },
    {
      id: "client-insight-1",
      priority: "insight",
      message: "Delivery is still on track for tomorrow morning.",
      prompt: "Give me a quick delivery status update for my most recent shoot.",
      action: "View status",
    },
    {
      id: "client-assist-1",
      priority: "assistive",
      message: "Need an ETA summary or help requesting an edit?",
      prompt: "Summarize the ETA and how I can request an edit if needed.",
      action: "Get help",
    },
  ],
};

const allowedRoles: UserRole[] = ["admin", "superadmin", "salesRep", "client"];

const getRotationDelay = () =>
  ROTATION_MIN_MS + Math.floor(Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS + 1));

export const RobbieInsightStrip: React.FC<RobbieInsightStripProps> = ({ role, className }) => {
  const { role: authRole } = useAuth();
  const navigate = useNavigate();
  const activeRole = role ?? authRole;
  const isAllowedRole = Boolean(activeRole && allowedRoles.includes(activeRole));
  const roleKey = (activeRole === "superadmin" ? "admin" : activeRole) ?? "admin";

  const insights = useMemo(() => {
    if (!isAllowedRole) return [];
    const roleInsights = insightsByRole[roleKey as keyof typeof insightsByRole] ?? [];
    const blockingInsights = roleInsights.filter((insight) => insight.priority === "blocking");
    const prioritized = (blockingInsights.length ? blockingInsights : roleInsights).slice(0, 5);
    return prioritized;
  }, [isAllowedRole, roleKey]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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

  if (!isAllowedRole || !activeInsight) return null;

  const meta = priorityMeta[activeInsight.priority];

  const handleOpenChat = () => {
    const context: AiChatRequest["context"] = {
      mode: "insight",
      intent: activeInsight.intent,
      source: "robbie_insight_strip",
      insightId: activeInsight.id,
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
      aria-label={`Robbie insight: ${activeInsight.message}`}
      onClick={handleOpenChat}
      onKeyDown={(event) => {
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
            key={activeInsight.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="min-w-0 text-sm font-medium text-foreground/90 truncate"
            title={activeInsight.message}
          >
            {activeInsight.message}
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
