// Unit tests for the Studio shell destination registry and URL route state
// (ai-editing-studio-revamp, task 10.1).
//
// Covers: Command_Center default without a deep-link (Req 1.1), a control-ready
// registry entry for every Studio_Destination (Req 1.5 groundwork), destination
// selection reflected in route state (Req 1.7, 1.10), derivation of the existing
// `activeSubtab`/capability view model from the active destination (Req 13.1 /
// preserved editing panels), and the shell adding no chrome of its own so the
// Application_Sidebar stays the only sidebar (Req 1.2, 1.6).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { STUDIO_DESTINATION_IDS, type StudioDestinationId } from '@/services/studioService';
import { studioService } from '@/services/studioService';
import { StudioShell, useStudioShell } from './StudioShell';
import {
  DEFAULT_STUDIO_DESTINATION,
  STUDIO_DESTINATIONS,
  isStudioDestinationId,
  routeTargetToDestination,
} from './destinations';
import {
  formatStudioRecordRef,
  parseStudioRecordRef,
  readStudioRouteState,
  writeStudioRouteState,
} from './studioRouteState';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(studioService, 'resolveDeepLink').mockImplementation(async (link) => ({
    ok: true,
    destination: link.destination,
    record: { id: link.recordId },
  }));
});

function Probe() {
  const shell = useStudioShell();
  const location = useLocation();

  return (
    <div>
      <span data-testid="destination">{shell.destination}</span>
      <span data-testid="subtab">{shell.activeSubtab}</span>
      <span data-testid="photo-capability">{shell.photoCapability}</span>
      <span data-testid="video-capability">{shell.videoCapability}</span>
      <span data-testid="record">
        {shell.record ? formatStudioRecordRef(shell.record) : 'none'}
      </span>
      <span data-testid="search">{location.search}</span>
      <button type="button" onClick={() => shell.setDestination('batch-ai-jobs')}>
        go batch
      </button>
      <button
        type="button"
        onClick={() => shell.selectRecord({ recordType: 'project', recordId: 'p1' })}
      >
        select project
      </button>
      <button type="button" onClick={() => shell.setSubtab('video')}>
        go video
      </button>
      <button
        type="button"
        onClick={() => shell.setDestinationFromRouteTarget({ subtab: 'photo', photoMode: 'sky_replace' })}
      >
        go twilight
      </button>
    </div>
  );
}

function renderShell(initialUrl = '/ai-editing') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <StudioShell>
        <Probe />
      </StudioShell>
    </MemoryRouter>,
  );
}

describe('Studio destination registry', () => {
  it('has exactly one entry for every declared Studio_Destination', () => {
    expect(STUDIO_DESTINATIONS.map((d) => d.id)).toEqual([...STUDIO_DESTINATION_IDS]);
    expect(new Set(STUDIO_DESTINATIONS.map((d) => d.id)).size).toBe(
      STUDIO_DESTINATION_IDS.length,
    );
  });

  it('gives every entry a label, kind, permission, media type, and a derivable view model', () => {
    for (const destination of STUDIO_DESTINATIONS) {
      expect(destination.label.length).toBeGreaterThan(0);
      expect(['overview', 'management', 'workflow']).toContain(destination.kind);
      expect(['photo', 'video', 'mixed', 'none']).toContain(destination.mediaType);
      expect(destination.permission.resource).toBe('ai-editing');
      expect(destination.permission.action.length).toBeGreaterThan(0);
      expect(['studio', 'photo', 'video']).toContain(destination.view.subtab);
    }
  });

  it('recognizes only known destination ids', () => {
    expect(isStudioDestinationId('queue')).toBe(true);
    expect(isStudioDestinationId('not-a-destination')).toBe(false);
    expect(isStudioDestinationId(null)).toBe(false);
  });

  it('maps legacy route targets onto destinations', () => {
    expect(routeTargetToDestination({ subtab: 'studio' })).toBe('command-center');
    expect(routeTargetToDestination({ subtab: 'photo' })).toBe('photo-enhancement');
    expect(routeTargetToDestination({ subtab: 'photo', photoMode: 'sky_replace' })).toBe(
      'twilight',
    );
    expect(routeTargetToDestination({ subtab: 'photo', photoCapability: 'batch' })).toBe(
      'batch-ai-jobs',
    );
    expect(routeTargetToDestination({ subtab: 'video' })).toBe('listing-video');
    expect(routeTargetToDestination({ subtab: 'video', videoCapability: 'reel' })).toBe(
      'reel-generator',
    );
    expect(routeTargetToDestination({ subtab: 'video', videoCapability: 'cleanup' })).toBe(
      'video-cleanup',
    );
  });
});

describe('Studio route state encoding', () => {
  it('defaults to the Command_Center when no destination param is present', () => {
    const state = readStudioRouteState(new URLSearchParams(''));
    expect(state.destination).toBe(DEFAULT_STUDIO_DESTINATION);
    expect(state.isDefaultDestination).toBe(true);
    expect(state.record).toBeNull();
  });

  it('falls back to the Command_Center for an unknown destination param', () => {
    const state = readStudioRouteState(new URLSearchParams('d=nope'));
    expect(state.destination).toBe('command-center');
    expect(state.isDefaultDestination).toBe(true);
  });

  it('round-trips every destination with and without a record ref', () => {
    for (const id of STUDIO_DESTINATION_IDS as readonly StudioDestinationId[]) {
      const bare = readStudioRouteState(
        writeStudioRouteState(new URLSearchParams(), { destination: id }),
      );
      expect(bare.destination).toBe(id);
      expect(bare.record).toBeNull();

      const withRecord = readStudioRouteState(
        writeStudioRouteState(new URLSearchParams(), {
          destination: id,
          record: { recordType: 'ai_job', recordId: 'photo-12' },
        }),
      );
      expect(withRecord.destination).toBe(id);
      expect(withRecord.record).toEqual({ recordType: 'ai_job', recordId: 'photo-12' });
    }
  });

  it('rejects malformed or unknown record refs', () => {
    expect(parseStudioRecordRef(null)).toBeNull();
    expect(parseStudioRecordRef('project')).toBeNull();
    expect(parseStudioRecordRef(':p1')).toBeNull();
    expect(parseStudioRecordRef('project:')).toBeNull();
    expect(parseStudioRecordRef('invoice:1')).toBeNull();
    expect(parseStudioRecordRef('project:p:1')).toEqual({
      recordType: 'project',
      recordId: 'p:1',
    });
  });

  it('preserves unrelated query params and clears a dropped record', () => {
    const next = writeStudioRouteState(new URLSearchParams('tab=x&rec=project:p1'), {
      destination: 'queue',
    });
    expect(next.get('tab')).toBe('x');
    expect(next.get('d')).toBe('queue');
    expect(next.get('rec')).toBeNull();
  });
});

describe('StudioShell', () => {
  it('opens the Command_Center by default and derives the studio subtab', () => {
    renderShell();
    expect(screen.getByTestId('destination')).toHaveTextContent('command-center');
    expect(screen.getByTestId('subtab')).toHaveTextContent('studio');
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('adds no chrome of its own, keeping the Application_Sidebar the only sidebar', () => {
    const { container } = renderShell();
    expect(container.querySelectorAll('aside')).toHaveLength(0);
    expect(container.querySelectorAll('nav')).toHaveLength(0);
  });

  it('reads the active destination and authorizes the record from route state', async () => {
    renderShell('/ai-editing?d=batch-ai-jobs&rec=project:p1');
    expect(screen.getByTestId('destination')).toHaveTextContent('batch-ai-jobs');
    expect(screen.getByTestId('subtab')).toHaveTextContent('photo');
    expect(screen.getByTestId('photo-capability')).toHaveTextContent('batch');
    await waitFor(() =>
      expect(screen.getByTestId('record')).toHaveTextContent('project:p1'),
    );
  });

  it('derives the video capability from the active destination', () => {
    renderShell('/ai-editing?d=reel-generator');
    expect(screen.getByTestId('subtab')).toHaveTextContent('video');
    expect(screen.getByTestId('video-capability')).toHaveTextContent('reel');
  });

  it('writes the selected destination into route state', async () => {
    const user = userEvent.setup({ delay: null });
    renderShell();

    await user.click(screen.getByRole('button', { name: 'go batch' }));

    expect(screen.getByTestId('destination')).toHaveTextContent('batch-ai-jobs');
    expect(screen.getByTestId('search')).toHaveTextContent('d=batch-ai-jobs');
  });

  it('maps a legacy route target onto its destination', async () => {
    const user = userEvent.setup({ delay: null });
    renderShell();

    await user.click(screen.getByRole('button', { name: 'go twilight' }));

    expect(screen.getByTestId('destination')).toHaveTextContent('twilight');
    expect(screen.getByTestId('subtab')).toHaveTextContent('photo');
  });

  it('keeps the destination when selecting a record', async () => {
    const user = userEvent.setup({ delay: null });
    renderShell('/ai-editing?d=projects');

    await user.click(screen.getByRole('button', { name: 'select project' }));

    expect(screen.getByTestId('destination')).toHaveTextContent('projects');
    await waitFor(() =>
      expect(screen.getByTestId('record')).toHaveTextContent('project:p1'),
    );
    expect(screen.getByTestId('search')).toHaveTextContent('rec=project%3Ap1');
  });

  it('returns to the last destination used for a subtab', async () => {
    const user = userEvent.setup({ delay: null });
    renderShell('/ai-editing?d=video-cleanup');
    expect(screen.getByTestId('video-capability')).toHaveTextContent('cleanup');

    await user.click(screen.getByRole('button', { name: 'go batch' }));
    expect(screen.getByTestId('subtab')).toHaveTextContent('photo');

    await user.click(screen.getByRole('button', { name: 'go video' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('video-cleanup');
  });
});
