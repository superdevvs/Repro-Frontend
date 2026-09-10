import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowUpRight } from 'lucide-react';
import { trackLinkClick } from '@/lib/tourTracking';
import type { PublicTourData } from '../publicTourData';
import { FloorplanSection } from '../FloorplanSection';
import { Public3dTourViewer } from '../Public3dTourViewer';
import { restrictedVideoProps } from '../videoControlRestrictions';
import { homeifyEmbedUrl } from '../homeify/homeifyMediaUtils';
import { LandorGallery } from './LandorGallery';
import { getLandorMedia, type LandorMediaTab } from './landorMediaModel';

function LandorVideo({ url, title, autoplay, poster }: { url: string; title: string; autoplay: boolean; poster?: string }) {
  const source = homeifyEmbedUrl(url, autoplay);
  if (!source) return null;
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(source)
    ? <video className="landor-video-frame" src={source} title={title} controls playsInline preload="metadata" poster={poster || undefined} autoPlay={autoplay} muted={autoplay} {...restrictedVideoProps} />
    : <iframe className="landor-video-frame" src={source} title={title} allow="autoplay; fullscreen; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />;
}

/** One accessible media panel, populated only with the property's published assets. */
export function LandorMedia({ data }: { data: PublicTourData }) {
  const [selected, setSelected] = useState<LandorMediaTab>('photos');
  const { photos, floorplans, videos, embeds, hasProviders, available } = getLandorMedia(data);
  const active = available.some((tab) => tab.id === selected) ? selected : available[0]?.id;
  const track = (url: string) => {
    if (data.analytics.shootId !== null) trackLinkClick(data.analytics.shootId, data.analytics.tourType, 'embed', url);
  };

  if (!available.length) return null;

  return (
    <section className="landor-media" id="media" aria-label="Property media">
      <Tabs.Root value={active} onValueChange={(value) => setSelected(value as LandorMediaTab)} activationMode="manual">
        <div className="landor-section-heading">
          <h2>Explore the property.</h2>
          <Tabs.List className="landor-media-tabs" aria-label="Property media type">
            {available.map((tab) => <Tabs.Trigger key={tab.id} className="landor-media-tab" value={tab.id}>{tab.label}</Tabs.Trigger>)}
          </Tabs.List>
        </div>

        {photos.length > 0 && <Tabs.Content className="landor-media-panel" value="photos">
          <LandorGallery photos={photos} address={data.shoot?.address || 'Property'} shootId={data.analytics.shootId ?? undefined} tourType={data.analytics.tourType} />
        </Tabs.Content>}

        {floorplans.length > 0 && <Tabs.Content className="landor-media-panel" value="plans">
          <FloorplanSection floorplans={floorplans} />
        </Tabs.Content>}

        {videos.length > 0 && <Tabs.Content className="landor-media-panel" value="video">
          {videos.map((video, index) => <LandorVideo key={video} url={video} title={`Property video ${index + 1}`} poster={data.videoPosterUrl || photos[0]} autoplay={index === 0 && data.tourSettings.autoplay} />)}
        </Tabs.Content>}

        {(hasProviders || embeds.length > 0) && <Tabs.Content className="landor-media-panel" value="tour">
          {hasProviders && <Public3dTourViewer sectionId="landor-tour" heading="Explore in 3D" iguideInlineUrl={data.iguide.inlineUrl} iguideOpenUrl={data.iguide.openUrl} matterportUrl={data.matterportUrl} autoplay={data.tourSettings.autoplay} />}
          {embeds.map((embed) => <section className="landor-embedded-tour" key={embed.id}>
            <div className="landor-section-heading"><h3>{embed.title}</h3><a className="landor-media-external" href={embed.url} target="_blank" rel="noopener noreferrer" onClick={() => track(embed.url)}>Open tour <ArrowUpRight size={16} aria-hidden="true" /></a></div>
            <LandorVideo url={embed.url} title={embed.title} autoplay={data.tourSettings.autoplay} />
          </section>)}
        </Tabs.Content>}
      </Tabs.Root>
    </section>
  );
}
