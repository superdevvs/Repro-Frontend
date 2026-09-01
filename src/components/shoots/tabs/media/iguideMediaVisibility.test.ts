import { describe, expect, it } from 'vitest';
import { normalizeIguideOfflinePackage } from '@/utils/shootTourData';
import { canShowIguideMedia } from './iguideMediaVisibility';

const readyPackage = normalizeIguideOfflinePackage({
  id: 'package-1',
  file_id: 72,
  status: 'ready',
});

describe('canShowIguideMedia', () => {
  it('shows an offline-only iGUIDE tab to staff and clients when it is ready', () => {
    expect(canShowIguideMedia({
      iguideUrl: '',
      isAdmin: true,
      isClient: false,
      isEditor: false,
      offlinePackage: readyPackage,
    })).toBe(true);

    expect(canShowIguideMedia({
      iguideUrl: '',
      isAdmin: false,
      isClient: true,
      isEditor: false,
      offlinePackage: normalizeIguideOfflinePackage({ status: 'ready' }),
    })).toBe(true);
  });

  it('keeps unfinished offline packages hidden from clients and all packages hidden from editors', () => {
    expect(canShowIguideMedia({
      iguideUrl: '',
      isAdmin: false,
      isClient: true,
      isEditor: false,
      offlinePackage: normalizeIguideOfflinePackage({
        id: 'package-2',
        file_id: 73,
        status: 'scanning',
      }),
    })).toBe(false);

    expect(canShowIguideMedia({
      iguideUrl: '',
      isAdmin: true,
      isClient: false,
      isEditor: true,
      offlinePackage: readyPackage,
    })).toBe(false);
  });

  it('preserves existing public-tour visibility while keeping editors excluded', () => {
    expect(canShowIguideMedia({
      iguideUrl: 'https://youriguide.com/example',
      isAdmin: false,
      isClient: true,
      isEditor: false,
      offlinePackage: readyPackage,
    })).toBe(true);

    expect(canShowIguideMedia({
      iguideUrl: 'https://youriguide.com/example',
      isAdmin: false,
      isClient: false,
      isEditor: true,
      offlinePackage: readyPackage,
    })).toBe(false);
  });
});
