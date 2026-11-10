import { useState } from 'react';
import { isUnsuitableShootCardHeroUrl } from '@/utils/shootCardHero';

/** Try real property thumbnails before showing the service cover. */
export const useShootCardPhoto = (candidates: readonly (string | null | undefined)[]) => {
  const images = [...new Set(candidates.filter((url): url is string => Boolean(url) && !isUnsuitableShootCardHeroUrl(url)))];
  const signature = JSON.stringify(images);
  const [failed, setFailed] = useState<{ signature: string; urls: string[] }>({ signature: '', urls: [] });
  const failedUrls = failed.signature === signature ? failed.urls : [];
  const image = images.find(url => !failedUrls.includes(url));
  const onImageError = () => {
    if (image) setFailed(previous => ({
      signature,
      urls: [...new Set([...(previous.signature === signature ? previous.urls : []), image])],
    }));
  };
  return { image, onImageError };
};
