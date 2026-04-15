import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { ShootData } from '@/types/shoots';

const getLegacyRawPhotoCount = (shoot?: ShootData | null) => {
  if (!shoot || typeof shoot !== 'object') {
    return undefined;
  }

  const legacyShoot = shoot as ShootData & {
    raw_photo_count?: number;
  };

  return legacyShoot.raw_photo_count;
};

export function useShootRawFileCount(
  shootId: string | number | null | undefined,
  enabled: boolean,
  shoot?: ShootData | null,
) {
  const [rawFileCount, setRawFileCount] = useState(0);

  useEffect(() => {
    const fetchRawFileCount = async () => {
      const fallbackCount = Number(
        shoot?.rawPhotoCount ??
          getLegacyRawPhotoCount(shoot) ??
          shoot?.mediaSummary?.rawUploaded ??
          0,
      );

      if (!shootId || !enabled) {
        setRawFileCount(fallbackCount);
        return;
      }

      try {
        const headers = getApiHeaders();
        headers.Accept = 'application/json';
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=raw`, {
          headers,
        });

        if (!res.ok) return;

        const data = await res.json();
        const files = data.data || data.files || data || [];
        setRawFileCount(Array.isArray(files) ? files.length : 0);
      } catch (error) {
        console.error('Failed to fetch raw file count:', error);
        setRawFileCount(fallbackCount);
      }
    };

    void fetchRawFileCount();
  }, [enabled, shoot, shootId]);

  return rawFileCount;
}
