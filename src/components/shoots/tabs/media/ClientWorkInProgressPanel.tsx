import { Loader2, Sparkles } from 'lucide-react';

import { Progress } from '@/components/ui/progress';

/**
 * The client-facing "Work in Progress" state shown before a shoot is finalized.
 *
 * Extracted verbatim from `useShootDetailsMediaTab` to keep that module within
 * its recorded file-size baseline. Markup, copy and progress maths are unchanged.
 */
export function ClientWorkInProgressPanel({
  clientProgress,
}: {
  clientProgress: {
    percent: number;
    label: string;
    description: string;
    steps: readonly { readonly key: string; readonly percent: number; readonly stageLabel: string }[];
  };
}) {
  const progress = clientProgress.percent;
  const progressLabel = clientProgress.label;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background px-3 sm:px-4 lg:px-6 items-center justify-center" style={{ height: '100%', minHeight: '300px' }}>
      <div className="flex flex-col items-center justify-center max-w-md text-center space-y-6 py-12">
        {/* Animated icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
          </div>
        </div>

        {/* Title and description */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Work in Progress</h3>
          <p className="text-sm text-muted-foreground">
            {clientProgress.description}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progressLabel}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Status steps */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            {clientProgress.steps.map((step) => (
              <div key={step.key} className={`flex flex-col items-center gap-1 ${progress >= step.percent ? 'text-primary' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${progress >= step.percent ? 'bg-primary' : 'bg-muted'}`} />
                <span>{step.stageLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
