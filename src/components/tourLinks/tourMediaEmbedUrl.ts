/**
 * Convert watch/share media URLs into iframe-safe embed URLs.
 * Used for tour `video_link` and Virtual Tours `embeds` URL values (not raw HTML).
 */
export const getTourMediaEmbedUrl = (url: string): string | null => {
  if (!url) return null;

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Match share URLs (vimeo.com/ID?share=…) and already-player URLs with /video/ID.
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return url;
};
