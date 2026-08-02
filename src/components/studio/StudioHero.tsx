import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

import { HeroPreview, type HeroPreviewImage } from './HeroPreview';

export interface StudioHeroProps {
  previewBefore?: HeroPreviewImage | null;
  previewAfter?: HeroPreviewImage | null;
  onOpenProjectLauncher?: () => void;
  className?: string;
}

export function StudioHero({
  previewBefore,
  previewAfter,
  onOpenProjectLauncher,
  className,
}: StudioHeroProps) {
  const reducedMotion = useReducedMotion();
  return (
    <section className={cn('relative overflow-hidden p-5 sm:p-7', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.35 }}
        className="relative space-y-6"
      >
        <div className="max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI media workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Turn source media into listing-ready work.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Start with a shoot or upload, choose a workflow, and track every output in one place.
          </p>
        </div>
        <HeroPreview
          before={previewBefore}
          after={previewAfter}
          onOpenProjectLauncher={onOpenProjectLauncher}
        />
      </motion.div>
    </section>
  );
}

export type { HeroPreviewImage };
export default StudioHero;

