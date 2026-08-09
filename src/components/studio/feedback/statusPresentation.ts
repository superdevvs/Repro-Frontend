import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Info,
  Loader2,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

/**
 * Shared status presentation for the AI Editing Studio (ai-editing-studio-revamp,
 * task 16.4).
 *
 * Every Studio status is resolved to a **text label plus an icon** alongside its
 * color role, so status is never communicated by color alone (Req 12.11). The
 * mapping is pure and total: unknown or empty statuses still yield a non-empty
 * label, an icon, and an accessible label, so any control can render a
 * `<StatusBadge>` without special-casing server values.
 */

/** Color role for a status. Text + icon always accompany the role (Req 12.11). */
export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'error';

export interface StatusPresentation {
  /** Normalized status key (lowercased, trimmed) or `unknown`. */
  status: string;
  /** Visible text label — always non-empty. */
  label: string;
  tone: StatusTone;
  /** Icon rendered next to the label; carries the accessible label. */
  icon: LucideIcon;
  /** Accessible label for the icon, e.g. `Status: Failed`. */
  accessibleLabel: string;
  /** True for in-flight statuses whose icon may spin (respects reduced motion). */
  isBusy: boolean;
}

const UNKNOWN_STATUS = 'unknown';

interface StatusDefinition {
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
  isBusy?: boolean;
}

/**
 * Known Studio statuses. Keys cover the `QueueRecord` statuses from
 * `studioService` plus the upload/mutation states shared by Studio controls.
 */
const STATUS_DEFINITIONS: Record<string, StatusDefinition> = {
  pending: { label: 'Pending', tone: 'info', icon: Clock },
  queued: { label: 'Queued', tone: 'info', icon: Clock },
  processing: { label: 'Processing', tone: 'progress', icon: Loader2, isBusy: true },
  stitching: { label: 'Stitching', tone: 'progress', icon: Loader2, isBusy: true },
  uploading: { label: 'Uploading', tone: 'progress', icon: UploadCloud, isBusy: true },
  completed: { label: 'Completed', tone: 'success', icon: CheckCircle2 },
  ready: { label: 'Ready', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'error', icon: XCircle },
  rejected: { label: 'Rejected', tone: 'error', icon: XCircle },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  canceled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  unavailable: { label: 'Unavailable', tone: 'warning', icon: AlertTriangle },
  draft: { label: 'Draft', tone: 'neutral', icon: CircleDashed },
  [UNKNOWN_STATUS]: { label: 'Unknown', tone: 'neutral', icon: Info },
};

/** Tailwind classes per tone. Each pairs a color role with readable text. */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/40 dark:bg-slate-400/10 dark:text-slate-200',
  info:
    'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200',
  progress:
    'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-200',
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200',
  warning:
    'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100',
  error:
    'border-red-300 bg-red-50 text-red-700 dark:border-red-400/50 dark:bg-red-400/10 dark:text-red-200',
};

/** `Photo enhancement` from `photo_enhancement` / `photo-enhancement`. */
export function humanizeStatus(status: string): string {
  const words = status
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!words) return STATUS_DEFINITIONS[UNKNOWN_STATUS].label;

  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * Resolves any server status into text + icon + tone. Total function: an empty,
 * null, or unrecognized status still returns a non-empty label and an icon so a
 * badge never falls back to color alone (Req 12.11).
 */
export function resolveStatusPresentation(
  status: string | null | undefined,
  overrides?: { label?: string; tone?: StatusTone },
): StatusPresentation {
  const normalized = (status ?? '').trim().toLowerCase();
  // Own-property check only: a bare index would resolve inherited keys such as
  // `constructor` or `toString` to a truthy Object.prototype member, which then
  // survives the `??` below and yields `icon: undefined`, breaking Req 12.11.
  const known =
    normalized && Object.prototype.hasOwnProperty.call(STATUS_DEFINITIONS, normalized)
      ? STATUS_DEFINITIONS[normalized]
      : undefined;
  const definition = known ?? STATUS_DEFINITIONS[UNKNOWN_STATUS];
  const label = overrides?.label?.trim() || (known ? definition.label : humanizeStatus(normalized));
  const tone = overrides?.tone ?? definition.tone;

  return {
    status: normalized || UNKNOWN_STATUS,
    label,
    tone,
    icon: definition.icon,
    accessibleLabel: `Status: ${label}`,
    isBusy: Boolean(definition.isBusy),
  };
}

/** Every status key with an explicit definition (useful for tests/registries). */
export const KNOWN_STATUS_KEYS = Object.keys(STATUS_DEFINITIONS).filter(
  (key) => key !== UNKNOWN_STATUS,
);
