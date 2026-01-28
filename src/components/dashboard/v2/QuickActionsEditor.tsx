import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  Link,
  Mail,
  Map as MapIcon,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickActionIconKey =
  | "check"
  | "calendar"
  | "message"
  | "sparkles"
  | "upload"
  | "route"
  | "phone"
  | "mail"
  | "flag"
  | "star";

type IconComponent = React.ComponentType<{ size?: number | string; className?: string }>;

export const QUICK_ACTION_ICON_MAP: Record<QuickActionIconKey, IconComponent> = {
  check: CheckCircle2,
  calendar: CalendarDays,
  message: MessageSquare,
  sparkles: Sparkles,
  upload: UploadCloud,
  route: MapIcon,
  phone: Phone,
  mail: Mail,
  flag: Flag,
  star: Star,
};

export const QUICK_ACTION_ICON_OPTIONS = (Object.entries(QUICK_ACTION_ICON_MAP) as Array<[
  QuickActionIconKey,
  IconComponent,
]>).map(([value, Icon]) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  icon: Icon,
}));

export const QUICK_ACTION_ACCENT_OPTIONS = [
  {
    value:
      "from-white/95 via-emerald-50/70 to-emerald-100/80 text-emerald-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-emerald-900/30 dark:text-emerald-200",
    label: "Emerald",
  },
  {
    value:
      "from-white/95 via-amber-50/70 to-amber-100/80 text-amber-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-amber-900/30 dark:text-amber-200",
    label: "Amber",
  },
  {
    value:
      "from-white/95 via-sky-50/70 to-sky-100/80 text-sky-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-sky-900/30 dark:text-sky-200",
    label: "Sky",
  },
  {
    value:
      "from-white/95 via-violet-50/70 to-violet-100/80 text-violet-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-violet-900/30 dark:text-violet-200",
    label: "Violet",
  },
  {
    value:
      "from-white/95 via-rose-50/70 to-rose-100/80 text-rose-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-rose-900/30 dark:text-rose-200",
    label: "Rose",
  },
  {
    value:
      "from-white/95 via-slate-50/70 to-slate-100/80 text-slate-700 dark:from-slate-950 dark:via-slate-900/80 dark:to-slate-800/60 dark:text-slate-200",
    label: "Slate",
  },
];

const DEFAULT_ACCENT =
  QUICK_ACTION_ACCENT_OPTIONS[0]?.value ||
  "from-white/95 via-emerald-50/70 to-emerald-100/80 text-emerald-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-emerald-900/30 dark:text-emerald-200";

const getAccentValue = (label: string) =>
  QUICK_ACTION_ACCENT_OPTIONS.find((option) => option.label === label)?.value || DEFAULT_ACCENT;

export type QuickActionPreset = {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: QuickActionIconKey;
  accent: string;
  group?: string;
  custom?: boolean;
};

const QUICK_ACTION_PRESET_GROUPS: Array<{
  label: string;
  presets: QuickActionPreset[];
}> = [
  {
    label: "Booking & Clients",
    presets: [
      {
        id: "book-shoot",
        label: "Book new shoot",
        description: "Schedule coverage fast.",
        url: "/book-shoot",
        icon: "calendar",
        accent: getAccentValue("Emerald"),
      },
      {
        id: "rebook",
        label: "Rebook last shoot",
        description: "Duplicate a previous order.",
        url: "/shoots/rebook",
        icon: "calendar",
        accent: getAccentValue("Sky"),
      },
      {
        id: "view-invoices",
        label: "View invoices",
        description: "Open billing overview.",
        url: "/invoices",
        icon: "check",
        accent: getAccentValue("Slate"),
      },
      {
        id: "make-payment",
        label: "Make a payment",
        description: "Pay outstanding balances.",
        url: "/invoices/pay",
        icon: "sparkles",
        accent: getAccentValue("Violet"),
      },
      {
        id: "contact-support",
        label: "Contact support",
        description: "Send a message to ops.",
        url: "mailto:support@reprophotos.com",
        icon: "mail",
        accent: getAccentValue("Rose"),
      },
    ],
  },
  {
    label: "Production & Editing",
    presets: [
      {
        id: "start-edit",
        label: "Start next edit",
        description: "Open the next queued job.",
        url: "/workflow/editing",
        icon: "sparkles",
        accent: getAccentValue("Violet"),
      },
      {
        id: "upload-edits",
        label: "Upload edits",
        description: "Deliver finished files.",
        url: "/media",
        icon: "upload",
        accent: getAccentValue("Emerald"),
      },
      {
        id: "flag-shoot",
        label: "Flag a shoot",
        description: "Log blockers for ops.",
        url: "/issues/new",
        icon: "flag",
        accent: getAccentValue("Rose"),
      },
      {
        id: "team-sync",
        label: "Sync with team",
        description: "Drop an update in chat.",
        url: "/chat",
        icon: "message",
        accent: getAccentValue("Slate"),
      },
    ],
  },
  {
    label: "Field & Assigning",
    presets: [
      {
        id: "todays-route",
        label: "Today's route",
        description: "Review schedule & maps.",
        url: "/shoot-history",
        icon: "route",
        accent: getAccentValue("Sky"),
      },
      {
        id: "upload-raws",
        label: "Upload RAWs",
        description: "Send camera originals.",
        url: "/media",
        icon: "upload",
        accent: getAccentValue("Slate"),
      },
      {
        id: "update-availability",
        label: "Update availability",
        description: "Set days off & travel.",
        url: "/photographer-availability",
        icon: "calendar",
        accent: getAccentValue("Amber"),
      },
      {
        id: "assign-photographer",
        label: "Assign photographer",
        description: "Match the next booking.",
        url: "/assignments",
        icon: "check",
        accent: getAccentValue("Emerald"),
      },
      {
        id: "view-availability",
        label: "View availability board",
        description: "See who is free.",
        url: "/availability",
        icon: "calendar",
        accent: getAccentValue("Sky"),
      },
    ],
  },
  {
    label: "Admin & Reporting",
    presets: [
      {
        id: "approval-queue",
        label: "Approval queue",
        description: "Review pending shoots.",
        url: "/workflow/approvals",
        icon: "check",
        accent: getAccentValue("Emerald"),
      },
      {
        id: "pending-requests",
        label: "Pending requests",
        description: "Track editing or client asks.",
        url: "/requests",
        icon: "sparkles",
        accent: getAccentValue("Rose"),
      },
      {
        id: "revenue-dashboard",
        label: "Revenue dashboard",
        description: "Open financial trends.",
        url: "/reports/revenue",
        icon: "star",
        accent: getAccentValue("Violet"),
      },
      {
        id: "team-workload",
        label: "Team workload",
        description: "Monitor utilization.",
        url: "/reports/workload",
        icon: "sparkles",
        accent: getAccentValue("Slate"),
      },
    ],
  },
  {
    label: "Custom",
    presets: [
      {
        id: "custom",
        label: "Custom link",
        description: "Define your own label and destination.",
        url: "",
        icon: "star",
        accent: getAccentValue("Slate"),
        custom: true,
      },
    ],
  },
];

export const QUICK_ACTION_PRESETS: QuickActionPreset[] = QUICK_ACTION_PRESET_GROUPS.flatMap((group) =>
  group.presets.map((preset) => ({ ...preset, group: group.label })),
);

export type QuickActionPresetId = QuickActionPreset["id"];

export const CUSTOM_PRESET_ID: QuickActionPresetId = "custom";

const DEFAULT_PRESET_ID = QUICK_ACTION_PRESETS.find((preset) => !preset.custom)?.id || CUSTOM_PRESET_ID;

const getPresetById = (presetId: QuickActionPresetId) =>
  QUICK_ACTION_PRESETS.find((preset) => preset.id === presetId) ||
  QUICK_ACTION_PRESETS.find((preset) => preset.id === CUSTOM_PRESET_ID)!;

const buildActionFromPreset = (
  presetId: QuickActionPresetId,
  overrides: Partial<CustomQuickAction> = {},
): CustomQuickAction => {
  const preset = getPresetById(presetId);
  const isCustom = preset.custom;
  return {
    id: overrides.id ?? generateQuickActionId(),
    presetId: preset.id,
    label: overrides.label ?? (isCustom ? "" : preset.label),
    description: overrides.description ?? (isCustom ? "" : preset.description),
    url: overrides.url ?? (isCustom ? "" : preset.url),
    icon: overrides.icon ?? preset.icon,
    accent: overrides.accent ?? preset.accent,
  };
};

export const normalizeQuickAction = (action: Partial<CustomQuickAction>): CustomQuickAction => {
  if (!action.presetId) {
    const matchingPreset = QUICK_ACTION_PRESETS.find(
      (preset) => preset.label === action.label && preset.url === action.url,
    );
    if (matchingPreset) {
      return buildActionFromPreset(matchingPreset.id, action);
    }
    return buildActionFromPreset(CUSTOM_PRESET_ID, action);
  }
  return buildActionFromPreset(action.presetId, action);
};

export const normalizeQuickActions = (actions: Partial<CustomQuickAction>[]) =>
  actions.map((action) => normalizeQuickAction(action));

export type CustomQuickAction = {
  id: string;
  presetId: QuickActionPresetId;
  label: string;
  description: string;
  url: string;
  icon: QuickActionIconKey;
  accent: string;
};

const generateQuickActionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createEmptyAction = (): CustomQuickAction => buildActionFromPreset(DEFAULT_PRESET_ID);

interface QuickActionsEditorProps {
  open: boolean;
  actions: CustomQuickAction[];
  onOpenChange: (open: boolean) => void;
  onSave: (actions: CustomQuickAction[]) => void;
}

export const QuickActionsEditor: React.FC<QuickActionsEditorProps> = ({
  open,
  actions,
  onOpenChange,
  onSave,
}) => {
  const [draftActions, setDraftActions] = useState<CustomQuickAction[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftActions(actions.length ? normalizeQuickActions(actions) : []);
    }
  }, [open, actions]);

  const handleAddAction = () => {
    setDraftActions((prev) => [...prev, createEmptyAction()]);
  };

  const handleUpdateAction = <K extends keyof CustomQuickAction>(id: string, key: K, value: CustomQuickAction[K]) => {
    setDraftActions((prev) => prev.map((action) => (action.id === id ? { ...action, [key]: value } : action)));
  };

  const handlePresetChange = (id: string, presetId: QuickActionPresetId) => {
    setDraftActions((prev) =>
      prev.map((action) => {
        if (action.id !== id) return action;
        const overrides: Partial<CustomQuickAction> = { id: action.id };
        if (presetId === CUSTOM_PRESET_ID) {
          overrides.label = action.label;
          overrides.description = action.description;
          overrides.url = action.url;
        } else {
          overrides.icon = action.icon;
          overrides.accent = action.accent;
        }
        return buildActionFromPreset(presetId, overrides);
      }),
    );
  };

  const handleRemoveAction = (id: string) => {
    setDraftActions((prev) => prev.filter((action) => action.id !== id));
  };

  const hasValidFields = useMemo(
    () =>
      draftActions.every(
        (action) =>
          action.presetId !== CUSTOM_PRESET_ID ||
          (action.label.trim().length > 0 &&
            action.description.trim().length > 0 &&
            action.url.trim().length > 0),
      ),
    [draftActions],
  );

  const handleSave = async () => {
    if (!hasValidFields) return;
    setSaving(true);
    onSave(draftActions.map((action) => normalizeQuickAction(action)));
    setSaving(false);
    onOpenChange(false);
  };

  const emptyState = draftActions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Customize quick actions</DialogTitle>
          <DialogDescription>
            Add shortcuts your team uses most. Pick from common presets or choose the custom option for your own link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {emptyState && (
            <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              No custom quick actions yet. Use the button below to create your first shortcut.
            </div>
          )}
          {draftActions.map((action, index) => {
            const Icon = QUICK_ACTION_ICON_MAP[action.icon];
            const isCustomPreset = action.presetId === CUSTOM_PRESET_ID;
            const preset = getPresetById(action.presetId);
            return (
              <div
                key={action.id}
                className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                      <Icon size={18} />
                    </span>
                    <div>
                      <p>Shortcut #{index + 1}</p>
                      <p className="text-xs text-muted-foreground">Customize icon & accent below</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => handleRemoveAction(action.id)}
                    title="Remove action"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Shortcut preset</Label>
                    <Select value={action.presetId} onValueChange={(val: QuickActionPresetId) => handlePresetChange(action.id, val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {QUICK_ACTION_PRESET_GROUPS.map((group, index) => (
                          <React.Fragment key={group.label}>
                            <SelectGroup>
                              <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                                {group.label}
                              </SelectLabel>
                              {group.presets.map((presetOption) => (
                                <SelectItem key={presetOption.id} value={presetOption.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{presetOption.label}</span>
                                    <span className="text-xs text-muted-foreground">{presetOption.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            {index < QUICK_ACTION_PRESET_GROUPS.length - 1 && <SelectSeparator />}
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose a built-in shortcut or switch to “Custom link” to enter your own label and destination.
                    </p>
                  </div>

                  {isCustomPreset ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`label-${action.id}`}>Label</Label>
                        <Input
                          id={`label-${action.id}`}
                          placeholder="Ex: Launch booking form"
                          value={action.label}
                          onChange={(event) => handleUpdateAction(action.id, "label", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`url-${action.id}`}>Link or route</Label>
                        <div className="relative">
                          <Input
                            id={`url-${action.id}`}
                            placeholder="/book-shoot or https://..."
                            value={action.url}
                            onChange={(event) => handleUpdateAction(action.id, "url", event.target.value)}
                            className="pl-9"
                          />
                          <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`description-${action.id}`}>Description</Label>
                        <Textarea
                          id={`description-${action.id}`}
                          placeholder="Explain what this shortcut does"
                          rows={3}
                          value={action.description}
                          onChange={(event) => handleUpdateAction(action.id, "description", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                      <p className="font-semibold text-foreground">{preset.label}</p>
                      <p className="text-muted-foreground">{preset.description}</p>
                      <p className="mt-2 text-xs font-mono text-muted-foreground/80">{preset.url}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select
                        value={action.icon}
                        onValueChange={(val: QuickActionIconKey) => handleUpdateAction(action.id, "icon", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick an icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUICK_ACTION_ICON_OPTIONS.map(({ value, label, icon: IconOption }) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <IconOption size={14} />
                                <span>{label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent</Label>
                      <Select
                        value={action.accent}
                        onValueChange={(val: string) => handleUpdateAction(action.id, "accent", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a color" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUICK_ACTION_ACCENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-full bg-gradient-to-br", option.value)} />
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="subtle" onClick={handleAddAction} className="gap-2">
            <Plus size={16} />
            Add quick action
          </Button>
          <DialogFooter className="flex-row gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!hasValidFields || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
