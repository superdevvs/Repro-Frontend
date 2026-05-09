import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface AiEditingStepperProps {
  steps: Step[];
  currentStepId: string;
  onStepClick?: (stepId: string) => void;
  isStepReachable?: (stepId: string) => boolean;
}

export const AiEditingStepper: React.FC<AiEditingStepperProps> = ({
  steps,
  currentStepId,
  onStepClick,
  isStepReachable,
}) => {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStepId),
  );

  return (
    <div className="w-full">
      <ol className="flex w-full items-center gap-2 sm:gap-3">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const reachable = isStepReachable ? isStepReachable(step.id) : isComplete || isCurrent;
          const clickable = Boolean(onStepClick && reachable && !isCurrent);

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.id)}
                className={cn(
                  'group flex flex-1 items-center gap-2 sm:gap-3 min-w-0 rounded-lg border p-2 sm:p-3 text-left transition-all',
                  isCurrent
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-background',
                  clickable && 'hover:border-primary/60 hover:bg-primary/5 cursor-pointer',
                  !clickable && !isCurrent && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs sm:text-sm font-semibold transition-colors',
                    isComplete
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isCurrent
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-xs sm:text-sm font-semibold leading-tight',
                      isCurrent ? 'text-foreground' : 'text-foreground/80',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="hidden sm:block truncate text-[11px] text-muted-foreground leading-tight">
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'hidden h-0.5 w-3 sm:w-6 flex-shrink-0 rounded-full sm:block',
                    isComplete ? 'bg-emerald-500/60' : 'bg-border',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default AiEditingStepper;
