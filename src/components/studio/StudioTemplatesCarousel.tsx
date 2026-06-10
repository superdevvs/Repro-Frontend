import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Sunset,
  Film,
  Layers,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { RouteTarget, RouteToCapability } from './types';

/**
 * StudioTemplatesCarousel — the Templates_Carousel of the Studio Landing.
 *
 * Renders a horizontally scrollable set of Templates (Req 7.1), each showing a
 * title and a short description (Req 7.2). Selecting a Template calls
 * `routeToCapability` with the Template's preset target (Req 7.3). Left/right
 * scroll controls let the Client reach Templates beyond the visible area
 * (Req 7.4).
 */
export interface StudioTemplatesCarouselProps {
  routeToCapability: RouteToCapability;
  className?: string;
}

export interface StudioTemplateDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  target: RouteTarget;
}

/**
 * The starting Template definitions and their `routeToCapability` targets.
 *
 * Exported so the routing behaviour can be exercised directly in tests
 * (Property 4, task 6.8) without rendering the full carousel.
 */
export const STUDIO_TEMPLATES: StudioTemplateDefinition[] = [
  {
    id: 'bright-listing',
    title: 'Bright Listing Set',
    description: 'Enhance a full shoot for a clean, bright MLS-ready gallery.',
    icon: Building2,
    target: { subtab: 'photo', photoMode: 'enhance', photoCapability: 'workspace' },
  },
  {
    id: 'twilight-exteriors',
    title: 'Twilight Exteriors',
    description: 'Turn daytime exterior shots into dramatic twilight scenes.',
    icon: Sunset,
    target: { subtab: 'photo', photoMode: 'sky_replace', photoCapability: 'workspace' },
  },
  {
    id: 'batch-enhance',
    title: 'Batch Enhance Shoot',
    description: 'Apply enhancement across every photo in a shoot at once.',
    icon: Boxes,
    target: { subtab: 'photo', photoCapability: 'batch' },
  },
  {
    id: 'listing-walkthrough',
    title: 'Listing Walkthrough',
    description: 'Build a branded listing video from a shoot’s media.',
    icon: Film,
    target: { subtab: 'video', videoCapability: 'listing' },
  },
  {
    id: 'social-reel',
    title: 'Social Reel',
    description: 'Generate a short-form vertical reel for social channels.',
    icon: Layers,
    target: { subtab: 'video', videoCapability: 'reel' },
  },
];

export function StudioTemplatesCarousel({
  routeToCapability,
  className,
}: StudioTemplatesCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const node = scrollRef.current;
    if (!node) return;
    // Scroll by roughly one card-width-and-gap so controls reach further Templates.
    const amount = Math.max(node.clientWidth * 0.8, 260);
    node.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Start from a template</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollBy('left')}
            aria-label="Scroll templates left"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scrollBy('right')}
            aria-label="Scroll templates right"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        role="list"
        aria-label="Starting templates"
      >
        {STUDIO_TEMPLATES.map((template, index) => {
          const Icon = template.icon;
          return (
            <motion.div
              key={template.id}
              role="listitem"
              className="w-64 shrink-0 snap-start"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <Card
                className="flex h-full cursor-pointer flex-col transition-colors hover:border-primary/50 hover:bg-accent/40"
                role="button"
                tabIndex={0}
                aria-label={`Start template ${template.title}`}
                onClick={() => routeToCapability(template.target)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    routeToCapability(template.target);
                  }
                }}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export default StudioTemplatesCarousel;
