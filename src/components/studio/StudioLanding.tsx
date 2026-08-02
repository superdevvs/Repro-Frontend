import { useState } from 'react';
import {
  ChevronDown,
  Image as ImageIcon,
  LayoutDashboard,
  Sparkles,
  Video,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resolveGeneratedAsset } from '@/lib/studioAssets';
import { cn } from '@/lib/utils';
import type { StudioShootRef } from '@/services/studioService';

import { CommandCenterSourcePanel } from './CommandCenterSourcePanel';
import { HeroPreview, type HeroPreviewImage } from './HeroPreview';
import { LiveQueue } from './LiveQueue';
import { ProjectLauncher } from './ProjectLauncher';
import { StudioRecentProjects } from './StudioRecentProjects';
import { StudioSearch } from './StudioSearch';
import { StudioLayoutRoot } from './layout/StudioLayout';
import type { RouteToCapability } from './types';
import { WorkflowGallery } from './WorkflowGallery';

export interface StudioLandingProps {
  routeToCapability: RouteToCapability;
  canUseAutoenhance?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

function image(placement: string, alt: string): HeroPreviewImage | null {
  const src = resolveGeneratedAsset(placement);
  return src ? { src, alt } : null;
}

export function StudioLanding({
  routeToCapability,
  canUseAutoenhance = false,
  className,
}: StudioLandingProps) {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [selectedShoot, setSelectedShoot] = useState<StudioShootRef | null>(null);

  return (
    <StudioLayoutRoot className={cn('gap-5', className)}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            AI Real Estate Media Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elevate your listings with AI-powered photo, video, and reel workflows.
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3 sm:flex-none">
          <StudioSearch className="w-full max-w-none sm:w-72" />
          <Button type="button" size="lg" onClick={() => setLauncherOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            New AI Project
            <span className="mx-2 h-5 w-px bg-primary-foreground/30" aria-hidden="true" />
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2.1fr)_minmax(19rem,1fr)]">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[17rem_minmax(0,1fr)]">
          <CommandCenterSourcePanel
            selectedShoot={selectedShoot}
            onShootSelect={setSelectedShoot}
            onChooseMedia={() => setLauncherOpen(true)}
          />
          <HeroPreview
            showHeader={false}
            className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
            before={image('hero-before', 'Contemporary luxury home before AI twilight enhancement')}
            after={image('hero-after', 'The same luxury home after AI twilight enhancement')}
            onOpenProjectLauncher={() => setLauncherOpen(true)}
          />
        </div>

        <aside className="min-w-0 rounded-xl border border-border bg-card p-3.5 xl:max-h-[31rem] xl:overflow-y-auto">
          <LiveQueue compact />
        </aside>
      </div>

      <nav
        aria-label="Studio pages"
        className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {[
          {
            label: 'Studio home',
            description: 'Overview and active work',
            icon: LayoutDashboard,
            target: { subtab: 'studio' as const },
            current: true,
          },
          {
            label: 'Photo studio',
            description: 'Enhance and batch photos',
            icon: ImageIcon,
            target: { subtab: 'photo' as const },
            current: false,
          },
          {
            label: 'Video studio',
            description: 'Listings, cleanup and reels',
            icon: Video,
            target: { subtab: 'video' as const },
            current: false,
          },
        ].map(({ label, description, icon: Icon, target, current }) => (
          <button
            key={label}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => routeToCapability(target)}
            className={cn(
              'group flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
              'bg-card/70 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-sm',
              current && 'border-primary/45 bg-primary/10',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors',
                current
                  ? 'bg-primary text-primary-foreground'
                  : 'group-hover:bg-primary/10 group-hover:text-primary',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {description}
              </span>
            </span>
          </button>
        ))}
      </nav>

      <WorkflowGallery
        compact
        routeToCapability={routeToCapability}
        canUseAutoenhance={canUseAutoenhance}
        previewImages={{
          'photo-enhancement': resolveGeneratedAsset('workflow-photo-enhancement'),
          twilight: resolveGeneratedAsset('workflow-twilight'),
          'video-cleanup': resolveGeneratedAsset('workflow-video-cleanup'),
          'listing-video': resolveGeneratedAsset('workflow-listing-video'),
          'reel-generator': resolveGeneratedAsset('workflow-reel-generator'),
          'batch-ai-jobs': resolveGeneratedAsset('workflow-batch-ai-jobs'),
        }}
      />

      <StudioRecentProjects
        cards
        limit={3}
        onNewProject={() => setLauncherOpen(true)}
        routeToCapability={routeToCapability}
      />

      <ProjectLauncher
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        canLaunch={canUseAutoenhance}
        initialShoot={selectedShoot}
      />
    </StudioLayoutRoot>
  );
}

export default StudioLanding;
