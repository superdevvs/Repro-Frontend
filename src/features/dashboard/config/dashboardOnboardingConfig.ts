/**
 * Role-aware onboarding configuration.
 *
 * This module is the single source of truth for the onboarding subsystem
 * (welcome dialog + guided spotlight tour + replay controls) across all five
 * roles. Each role entry encodes its canonical preference key, version,
 * localStorage fallback prefix, guided-tour steps (with `data-onboarding-target`
 * markers and best-effort mobile tab focus), and display copy.
 *
 * The `client` entry preserves the legacy `clientDashboardOnboarding` preference
 * key, the legacy `client-dashboard-onboarding` localStorage prefix, and the
 * existing 5-step client tour verbatim, so the established client experience is
 * byte-for-byte preserved.
 */

export type RoleKey = "client" | "photographer" | "salesRep" | "editing_manager" | "editor";

export type OnboardingStep = {
  /** Human-readable step heading. */
  title: string;
  /** Instructional body copy for the step. */
  description: string;
  /** Matches a `data-onboarding-target` value rendered in the role's Dashboard_View. */
  target: string;
  /** Role-specific mobile tab id used for best-effort focus during the tour. */
  mobileTab?: string;
};

export type OnboardingCopy = {
  welcomeTitle: string;
  welcomeDescription: string;
  checklistItems: string[];
  /** Sidebar/settings replay button label, e.g. "Take tour". */
  replayLabel: string;
};

export type RoleOnboardingConfig = {
  roleKey: RoleKey;
  /** `metadata.preferences.{onboardingKey}` storage key. */
  onboardingKey: string;
  version: number;
  /** localStorage key prefix: `{fallbackPrefix}:{userId}`. */
  fallbackPrefix: string;
  steps: OnboardingStep[];
  copy: OnboardingCopy;
};

/** Maximum number of replays permitted per user per role. */
export const REPLAY_CAP = 3;

/**
 * Client tour steps, copied verbatim from the legacy
 * `ClientDashboardOnboarding.tsx` `steps` array to preserve existing behavior.
 */
const clientSteps: OnboardingStep[] = [
  {
    title: "Start with your snapshot",
    description: "These cards summarize your active shoots, delivered media, items on hold, and payment status at a glance.",
    target: "client-dashboard-metrics",
  },
  {
    title: "Track every shoot",
    description: "Use Shoots to view scheduled jobs, open shoot details, download delivered media, rebook, or complete payment when needed.",
    target: "client-dashboard-shoots",
    mobileTab: "shoots",
  },
  {
    title: "Follow requests",
    description: "Use the Requests button in the top-right of My shoots to see the active request count and open Request Manager.",
    target: "client-dashboard-requests",
    mobileTab: "shoots",
  },
  {
    title: "Manage invoices",
    description: "Invoices keeps due-now, upcoming, and paid balances together with quick payment actions.",
    target: "client-dashboard-invoices",
    mobileTab: "invoices",
  },
  {
    title: "Open shoot details for more",
    description: "Select a shoot to find media, requests, tour links, settings like Private Exclusive and timezone, and activity history.",
    target: "client-dashboard-shoots",
    mobileTab: "shoots",
  },
];

/** Client welcome checklist, copied verbatim from the legacy component. */
const clientChecklistItems = [
  "Find scheduled and delivered shoots",
  "Download media and open shoot details",
  "Check active requests and revision status",
  "Review invoices and pay balances",
];

const photographerSteps: OnboardingStep[] = [
  {
    title: "Review your upcoming shoots",
    description: "Open any upcoming shoot to check its schedule, location, and details before you head out.",
    target: "photographer-upcoming-shoots",
    mobileTab: "shoots",
  },
  {
    title: "Handle client requests",
    description: "Open the Requests queue to see client requests tied to your shoots and respond before they pile up.",
    target: "photographer-requests",
    mobileTab: "requests",
  },
  {
    title: "Find your completed shoots",
    description: "Browse completed shoots to revisit finished jobs and the delivered media that's ready for clients.",
    target: "photographer-completed",
    mobileTab: "completed",
  },
];

const salesRepSteps: OnboardingStep[] = [
  {
    title: "Scan your sales metrics",
    description: "Check the metric tiles for a quick read on your pipeline, active jobs, and recent performance.",
    target: "salesrep-metrics",
  },
  {
    title: "Assign photographers",
    description: "Use the assign card to match available photographers to shoots and open their schedules.",
    target: "salesrep-assign",
  },
  {
    title: "Track upcoming shoots",
    description: "Review scheduled shoots so you can prep client communication ahead of each booking.",
    target: "salesrep-upcoming",
  },
  {
    title: "Work the requests queue",
    description: "Open Requests to handle editing, client, and cancellation items that need follow-up.",
    target: "salesrep-requests",
  },
  {
    title: "Confirm delivered shoots",
    description: "Review recently delivered shoots to confirm handoffs and share results with clients.",
    target: "salesrep-delivered",
  },
];

const editingManagerSteps: OnboardingStep[] = [
  {
    title: "Monitor incoming shoots",
    description: "Use the shoots tabs to track work arriving for editing and see where each shoot stands.",
    target: "editingmanager-shoots",
    mobileTab: "shoots",
  },
  {
    title: "Review pending requests",
    description: "Open pending reviews to act on items waiting on your decision and keep work moving.",
    target: "editingmanager-requests",
    mobileTab: "requests",
  },
  {
    title: "Deliver finished edits",
    description: "Check Ready to deliver for completed edits that are set to send to clients.",
    target: "editingmanager-ready",
    mobileTab: "ready",
  },
  {
    title: "Manage the pipeline",
    description: "Use the pipeline view to see every job across editing stages and balance the team's workload.",
    target: "editingmanager-pipeline",
    mobileTab: "pipeline",
  },
];

const editorSteps: OnboardingStep[] = [
  {
    title: "Scan your editor metrics",
    description: "Check the metric tiles for a quick read on your assigned edits, turnaround, and workload.",
    target: "editor-metrics",
  },
  {
    title: "Grab your raw files",
    description: "Use the raw links card to open the source files for your upcoming shoots and start editing.",
    target: "editor-raw-links",
  },
  {
    title: "Work your editing queue",
    description: "Open your editing queue to see uploads and active edits lined up for you to work through.",
    target: "editor-queue",
    mobileTab: "queue",
  },
  {
    title: "Handle revision requests",
    description: "Open Requests to pick up editing revisions and client notes that need your attention.",
    target: "editor-requests",
    mobileTab: "requests",
  },
  {
    title: "Review delivered edits",
    description: "Browse your delivered edits to confirm what's already been published.",
    target: "editor-delivered",
    mobileTab: "delivered",
  },
];

export const dashboardOnboardingConfig: Record<RoleKey, RoleOnboardingConfig> = {
  client: {
    roleKey: "client",
    onboardingKey: "clientDashboardOnboarding",
    version: 1,
    fallbackPrefix: "client-dashboard-onboarding",
    steps: clientSteps,
    copy: {
      welcomeTitle: "Welcome to your client dashboard",
      welcomeDescription:
        "Learn where to find shoots, requests, invoices, delivered media, and shoot details in under a minute.",
      checklistItems: clientChecklistItems,
      replayLabel: "Take tour",
    },
  },
  photographer: {
    roleKey: "photographer",
    onboardingKey: "photographerDashboardOnboarding",
    version: 1,
    fallbackPrefix: "photographer-dashboard-onboarding",
    steps: photographerSteps,
    copy: {
      welcomeTitle: "Welcome to your photographer dashboard",
      welcomeDescription:
        "See where to find your upcoming shoots, requests, and completed work in under a minute.",
      checklistItems: [
        "Review your upcoming shoots",
        "Stay on top of requests",
        "Find your completed shoots and delivered media",
      ],
      replayLabel: "Take tour",
    },
  },
  salesRep: {
    roleKey: "salesRep",
    onboardingKey: "salesRepDashboardOnboarding",
    version: 1,
    fallbackPrefix: "salesRep-dashboard-onboarding",
    steps: salesRepSteps,
    copy: {
      welcomeTitle: "Welcome to your sales dashboard",
      welcomeDescription:
        "Learn where to find your metrics, assignments, upcoming shoots, requests, and delivered work in under a minute.",
      checklistItems: [
        "Review your key metrics",
        "Assign photographers to shoots",
        "Track upcoming shoots and requests",
        "Confirm delivered work",
      ],
      replayLabel: "Take tour",
    },
  },
  editing_manager: {
    roleKey: "editing_manager",
    onboardingKey: "editingManagerDashboardOnboarding",
    version: 1,
    fallbackPrefix: "editingManager-dashboard-onboarding",
    steps: editingManagerSteps,
    copy: {
      welcomeTitle: "Welcome to your editing manager dashboard",
      welcomeDescription:
        "See where to monitor shoots, review requests, deliver edits, and manage the pipeline in under a minute.",
      checklistItems: [
        "Monitor incoming shoots",
        "Review pending requests",
        "Deliver finished edits",
        "Manage the editing pipeline",
      ],
      replayLabel: "Take tour",
    },
  },
  editor: {
    roleKey: "editor",
    onboardingKey: "editorDashboardOnboarding",
    version: 1,
    fallbackPrefix: "editor-dashboard-onboarding",
    steps: editorSteps,
    copy: {
      welcomeTitle: "Welcome to your editor dashboard",
      welcomeDescription:
        "Learn where to find your metrics, raw files, editing queue, requests, and delivered edits in under a minute.",
      checklistItems: [
        "Review your key metrics",
        "Grab your raw files",
        "Work your editing queue",
        "Stay on top of requests and delivered edits",
      ],
      replayLabel: "Take tour",
    },
  },
};

/**
 * Returns the onboarding configuration for the given Role_Key.
 */
export const getOnboardingConfig = (roleKey: RoleKey): RoleOnboardingConfig => dashboardOnboardingConfig[roleKey];
