import { motion } from 'framer-motion';
import {
  Boxes,
  Film,
  Layers,
  Sparkles,
  Sunset,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { RouteTarget, RouteToCapability } from './types';

/**
 * StudioFeatureCards — the six Feature_Cards of the Studio Landing.
 *
 * Renders exactly six cards (Req 4.1), each with a title, a short description
 * (Req 4.8), and a Start control. Activating a Start control calls
 * `routeToCapability` with the card's target per the design route mapping
 * (Req 4.2–4.7). When `canUseAutoenhance` is false the Start controls are
 * disabled so an unauthorized role cannot begin any capability (Req 12.1).
 */
export interface StudioFeatureCardsProps {
  routeToCapability: RouteToCapability;
  canUseAutoenhance?: boolean;
  className?: string;
}

export interface StudioFeatureCardDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  target: RouteTarget;
}

/**
 * The six Feature_Card definitions and their `routeToCapability` targets.
 *
 * Exported so the routing behaviour can be exercised directly in tests
 * (Property 4, task 6.8) without rendering the full landing.
 */
export const STUDIO_FEATURE_CARDS: StudioFeatureCardDefinition[] = [
  {
    id: 'Photo_Enhancement_Card',
    title: 'Photo Enhancement',
    description: 'Brighten, balance, and polish listing photos with one-tap AI enhancement.',
    icon: Sparkles,
    target: { subtab: 'photo', photoMode: 'enhance', photoCapability: 'workspace' },
  },
  {
    id: 'Twilight_Card',
    title: 'Twilight',
    description: 'Convert daytime exteriors into striking twilight shots with sky replacement.',
    icon: Sunset,
    target: { subtab: 'photo', photoMode: 'sky_replace', photoCapability: 'workspace' },
  },
  {
    id: 'Video_Cleanup_Card',
    title: 'Video Cleanup',
    description: 'Stabilize and clean up walkthrough footage for a polished result.',
    icon: Video,
    target: { subtab: 'video', videoCapability: 'cleanup' },
  },
  {
    id: 'Listing_Video_Card',
    title: 'Listing Video',
    description: 'Build a branded listing video from a shoot’s photos and clips.',
    icon: Film,
    target: { subtab: 'video', videoCapability: 'listing' },
  },
  {
    id: 'Reel_Generator_Card',
    title: 'Reel Generator',
    description: 'Generate short-form vertical reels from a shoot’s media in seconds.',
    icon: Layers,
    target: { subtab: 'video', videoCapability: 'reel' },
  },
  {
    id: 'Batch_Jobs_Card',
    title: 'Batch AI Jobs',
    description: 'Run an enhancement across every photo in a shoot in a single batch.',
    icon: Boxes,
    target: { subtab: 'photo', photoCapability: 'batch' },
  },
];

export function StudioFeatureCards({
  routeToCapability,
  canUseAutoenhance = false,
  className,
}: StudioFeatureCardsProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold tracking-tight">Capabilities</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_FEATURE_CARDS.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <Card className="flex h-full flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button
                    type="button"
                    onClick={() => routeToCapability(card.target)}
                    disabled={!canUseAutoenhance}
                    aria-label={`Start ${card.title}`}
                  >
                    Start
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export default StudioFeatureCards;
