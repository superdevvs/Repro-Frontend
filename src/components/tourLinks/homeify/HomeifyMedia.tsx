import { ExternalLink } from 'lucide-react';
import type { PublicTourData } from '../publicTourData';
import { FloorplanSection } from '../FloorplanSection';
import { Public3dTourViewer } from '../Public3dTourViewer';
import { restrictedVideoProps } from '../videoControlRestrictions';
import { trackLinkClick } from '@/lib/tourTracking';
import { homeifyEmbedUrl } from './homeifyMediaUtils';

function MediaFrame({ value, title, autoplay, poster }: { value: string; title: string; autoplay: boolean; poster?: string }) {
  const url = homeifyEmbedUrl(value, autoplay);
  if (!url) return null;
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)
    ? <video className="homeify-video" src={url} title={title} controls playsInline preload="metadata" poster={poster || undefined} autoPlay={autoplay} muted={autoplay} {...restrictedVideoProps} />
    : <iframe className="homeify-video" src={url} title={title} allow="autoplay; fullscreen; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />;
}

export function HomeifyMedia({ data }: { data: PublicTourData }) {
  const videos = Array.from(new Set([...data.videos, data.videoLink].map((video) => homeifyEmbedUrl(video)).filter(Boolean)));
  const embeds = data.embeds.map((embed) => ({ ...embed, url: homeifyEmbedUrl(embed.value) })).filter((embed) => Boolean(embed.url));
  const hasProviders = Boolean(data.iguide.inlineUrl || data.matterportUrl);
  const track = (type: string, url: string) => { if (data.analytics.shootId !== null) trackLinkClick(data.analytics.shootId, data.analytics.tourType, type, url); };
  return <>
    {videos.length > 0 && <section className="homeify-panel" id="video"><div className="homeify-panel-heading"><h2>Experience the home</h2><span className="homeify-subtle">Property video</span></div><div className="homeify-media-stack">{videos.map((video, index) => <MediaFrame key={video} value={video} title={`Property video ${index + 1}`} poster={data.videoPosterUrl || data.heroSlides[0]} autoplay={index === 0 && data.tourSettings.autoplay} />)}</div></section>}
    {hasProviders && <div className="homeify-panel homeify-shared-media"><Public3dTourViewer sectionId="tour" heading="Step inside" iguideInlineUrl={data.iguide.inlineUrl} iguideOpenUrl={data.iguide.openUrl} matterportUrl={data.matterportUrl} autoplay={data.tourSettings.autoplay} /></div>}
    {embeds.map((embed, index) => {
      return <section className="homeify-panel" id={!hasProviders && index === 0 ? 'tour' : `tour-embed-${index}`} key={embed.id}><div className="homeify-panel-heading"><h2>{embed.title}</h2><a className="homeify-text-link" href={embed.url} target="_blank" rel="noreferrer" onClick={() => track('embed', embed.url)}>Open tour <ExternalLink size={14} /></a></div><MediaFrame value={embed.url} title={embed.title} autoplay={data.tourSettings.autoplay} /></section>;
    })}
    {data.floorplans.length > 0 && <div className="homeify-floorplans"><FloorplanSection floorplans={data.floorplans} /></div>}
  </>;
}
