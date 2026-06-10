import { motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * StudioProUpsellBanner — the Pro_Upsell_Banner of the Studio Landing.
 *
 * Renders promotional text plus a call-to-action control (Req 8.1). Activating
 * the CTA initiates the upgrade prompt action by calling `onUpgrade` (Req 8.2).
 * Styled to match the AI Editing visual language using shadcn/ui primitives,
 * lucide-react icons, and a framer-motion entrance.
 */
export interface StudioProUpsellBannerProps {
  onUpgrade?: () => void;
  className?: string;
}

export function StudioProUpsellBanner({ onUpgrade, className }: StudioProUpsellBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6',
          className,
        )}
      >
        {/* Decorative accent — hidden from assistive tech. */}
        <Sparkles
          className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-primary/10"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Crown className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Upgrade to Studio Pro</h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                Unlock higher batch limits, priority AI processing, and advanced reel and
                twilight tools to finish every shoot faster.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => onUpgrade?.()}
            className="shrink-0"
            aria-label="Upgrade to Studio Pro"
          >
            Upgrade to Pro
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export default StudioProUpsellBanner;
