import { describe, expect, it } from 'vitest';
import { getPhotographerEditedMediaMlsLink, getPreferredMlsTourLink } from './shootTourData';

describe('getPhotographerEditedMediaMlsLink', () => {
  it('uses only explicit MLS-compliant links and never iGUIDE MLS fallback', () => {
    const shoot = {
      tourLinks: {
        iguide_mls: 'https://example.com/iguide-mls',
        genericMls: 'https://example.com/generic-mls',
        matterport_mls: 'https://example.com/matterport-mls',
      },
    };

    expect(getPreferredMlsTourLink(shoot)).toBe('https://example.com/generic-mls');
    expect(getPhotographerEditedMediaMlsLink(shoot)).toBe('');
  });

  it('prefers tourLinks.mls over legacy mls_compliant_link', () => {
    const shoot = {
      tourLinks: {
        mls: 'https://example.com/tour-links-mls',
      },
      mls_compliant_link: 'https://example.com/legacy-mls',
    };

    expect(getPhotographerEditedMediaMlsLink(shoot)).toBe('https://example.com/tour-links-mls');
  });
});
