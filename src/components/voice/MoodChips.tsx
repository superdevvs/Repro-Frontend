import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CUSTOMER_MOOD_CLASS: Record<string, string> = {
  positive: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  neutral: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  concerned: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  frustrated: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  angry: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
};

const ROBBIE_QUALITY_CLASS: Record<string, string> = {
  excellent: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  good: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  ok: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  poor: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
  looping: 'border-red-400 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200',
};

interface MoodChipsProps {
  customerMood?: string;
  robbieQuality?: string;
  className?: string;
}

export function MoodChips({ customerMood, robbieQuality, className }: MoodChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge
        variant="outline"
        className={cn('text-[11px] capitalize', CUSTOMER_MOOD_CLASS[customerMood ?? 'neutral'] ?? CUSTOMER_MOOD_CLASS.neutral)}
      >
        Customer: {customerMood ?? '—'}
      </Badge>
      <Badge
        variant="outline"
        className={cn('text-[11px] capitalize', ROBBIE_QUALITY_CLASS[robbieQuality ?? 'good'] ?? ROBBIE_QUALITY_CLASS.good)}
      >
        Robbie: {robbieQuality ?? '—'}
      </Badge>
    </div>
  );
}
