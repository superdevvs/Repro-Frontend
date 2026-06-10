import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

import { StudioHero } from './StudioHero';
import { StudioFeatureCards } from './StudioFeatureCards';
import { StudioRecentProjects } from './StudioRecentProjects';
import { StudioQueueStatus } from './StudioQueueStatus';
import { StudioTemplatesCarousel } from './StudioTemplatesCarousel';
import { StudioProUpsellBanner } from './StudioProUpsellBanner';
import type { RouteToCapability } from './types';

/**
 * StudioLanding is the default view of the Studio_Page ("AI Real Estate Media
 * Studio"). It composes every landing section (Req 1.2, 1.3):
 *
 *   - StudioHero             (title + three Hero_Stats)
 *   - StudioFeatureCards     (six capability cards → routeToCapability)
 *   - StudioRecentProjects   (live recent activity, deep-links)
 *   - StudioQueueStatus      (live active queue)
 *   - StudioTemplatesCarousel
 *   - StudioProUpsellBanner
 *
 * Routing into a Subtab/capability is delegated to the `routeToCapability`
 * callback supplied by the Studio shell, so the landing never navigates the
 * Client away from the page. The individual sections are filled in by tasks
 * 6.2–6.7; this component owns their composition and layout.
 */
export interface StudioLandingProps {
  /** Centralized navigation handler from the Studio shell (AiEditing.tsx). */
  routeToCapability: RouteToCapability;
  /** Existing role check gating capability Start controls (Req 12.1). */
  canUseAutoenhance?: boolean;
  /** CTA handler for the Pro upsell banner. */
  onUpgrade?: () => void;
  className?: string;
}

export function StudioLanding({
  routeToCapability,
  canUseAutoenhance,
  onUpgrade,
  className,
}: StudioLandingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('space-y-10', className)}
    >
      <StudioHero />

      <StudioFeatureCards
        routeToCapability={routeToCapability}
        canUseAutoenhance={canUseAutoenhance}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StudioRecentProjects routeToCapability={routeToCapability} />
        <StudioQueueStatus />
      </div>

      <StudioTemplatesCarousel routeToCapability={routeToCapability} />

      <StudioProUpsellBanner onUpgrade={onUpgrade} />
    </motion.div>
  );
}

export default StudioLanding;
