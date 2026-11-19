import { homeifyEmbedUrl } from '../homeify/homeifyMediaUtils';
import { restrictedVideoProps } from '../videoControlRestrictions';

type Props = { url: string; title: string; autoplay: boolean; poster?: string; className: string };

/** Plays a published film or provider embed; markup from saved embeds is reduced to its source URL. */
export function TemplateTourVideo({ url, title, autoplay, poster, className }: Props) {
  const source = homeifyEmbedUrl(url, autoplay);
  if (!source) return null;
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(source)
    ? <video className={className} src={source} title={title} controls playsInline preload="metadata" poster={poster || undefined} autoPlay={autoplay} muted={autoplay} {...restrictedVideoProps} />
    : <iframe className={className} src={source} title={title} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />;
}
