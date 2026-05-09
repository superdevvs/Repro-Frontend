import React from 'react';
import { Cloud, Layers, Move3D, Sparkles, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditingType } from '@/services/autoenhanceService';

interface AiEditingModePickerProps {
  modes: EditingType[];
  selectedModeId: string;
  onSelect: (modeId: string) => void;
  disabled?: boolean;
}

const MODE_ICONS: Record<string, React.ElementType> = {
  enhance: Sparkles,
  sky_replace: Cloud,
  hdr_merge: Layers,
  vertical_correction: Move3D,
  window_pull: Sun,
};

const MODE_TONE: Record<string, string> = {
  enhance: 'from-violet-500/15 via-blue-500/10 to-transparent',
  sky_replace: 'from-sky-500/15 via-cyan-500/10 to-transparent',
  hdr_merge: 'from-amber-500/15 via-orange-500/10 to-transparent',
  vertical_correction: 'from-emerald-500/15 via-teal-500/10 to-transparent',
  window_pull: 'from-yellow-500/15 via-amber-500/10 to-transparent',
};

export const AiEditingModePicker: React.FC<AiEditingModePickerProps> = ({
  modes,
  selectedModeId,
  onSelect,
  disabled,
}) => {
  if (modes.length === 0) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Autoenhance editing mode"
      className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
    >
      {modes.map((mode) => {
        const Icon = MODE_ICONS[mode.id] || Sparkles;
        const isSelected = mode.id === selectedModeId;
        const tone = MODE_TONE[mode.id] || 'from-primary/10 via-primary/5 to-transparent';

        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(mode.id)}
            className={cn(
              'group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border p-3 sm:p-4 text-left transition-all',
              isSelected
                ? 'border-primary ring-2 ring-primary/30 shadow-sm shadow-primary/10'
                : 'border-border hover:border-primary/50 hover:shadow-sm',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute inset-0 -z-0 bg-gradient-to-br opacity-90 transition-opacity',
                tone,
                isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-90',
              )}
            />
            <div className="relative z-10 flex w-full items-start justify-between gap-2">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg border bg-background/80 backdrop-blur',
                  isSelected ? 'border-primary text-primary' : 'border-border text-foreground/80',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {isSelected && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Selected
                </span>
              )}
            </div>
            <div className="relative z-10 space-y-1">
              <h3 className="text-sm font-semibold leading-tight">{mode.name}</h3>
              {mode.description && (
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{mode.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default AiEditingModePicker;
