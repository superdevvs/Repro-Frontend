import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import type { ShootStandingEditorNotes, StandingEditorNote } from '@/services/standingEditorNoteService';
import { EditorShootContextNotes } from './v2/EditorShootContextNotes';
import { StandingEditorNotesCard } from './StandingEditorNotesCard';
import { StandingEditorNotesBookingBanner } from '@/components/booking/StandingEditorNotesBookingBanner';

const service = vi.hoisted(() => ({
  setShootStandingEditorNotesHidden: vi.fn(),
  fetchClientStandingEditorNotes: vi.fn(),
}));
vi.mock('@/services/standingEditorNoteService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/standingEditorNoteService')>()),
  ...service,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const grass: StandingEditorNote = {
  id: 7, scope: 'brokerage', client_id: null, company_match: 'Weichert', label: 'Weichert brokerage',
  content: 'All Weichert agents get 1 complimentary exterior green grass.', updated_at: null,
};
const standing = (overrides: Partial<ShootStandingEditorNotes> = {}): ShootStandingEditorNotes =>
  ({ hidden: false, frozen: false, notes: [grass], ...overrides });

describe('editor dashboard strip', () => {
  const card = (notes: ShootStandingEditorNotes | null, editorNotes: string | null = 'Twilight on photo 14.') =>
    ({ id: 1, editorNotes, standingEditorNotes: notes } as unknown as DashboardShootSummary);

  it('puts the standing note first, labelled with the brokerage', () => {
    render(<EditorShootContextNotes shoot={card(standing())} />);
    const line = screen.getByTestId('editor-standing-note');
    expect(line).toHaveTextContent('Standing client note (Weichert):');
    expect(line).toHaveTextContent(grass.content);
    expect(screen.getByText('Twilight on photo 14.')).toBeInTheDocument();
  });

  it('shows the strip for a standing note even without per-shoot editing notes', () => {
    render(<EditorShootContextNotes shoot={card(standing(), null)} />);
    expect(screen.getByTestId('editor-standing-note')).toBeInTheDocument();
  });

  it('omits a note hidden on this shoot', () => {
    render(<EditorShootContextNotes shoot={card(standing({ hidden: true }), null)} />);
    expect(screen.queryByTestId('editor-standing-note')).toBeNull();
  });
});

describe('Notes tab pinned card', () => {
  it('is read-only for editors', () => {
    render(<StandingEditorNotesCard shootId={42} clientId={9} value={standing()} canManage={false} />);
    expect(screen.getByTestId('standing-editor-notes-card')).toHaveTextContent(grass.content);
    expect(screen.queryByRole('button', { name: 'Hide on this shoot' })).toBeNull();
  });

  it('lets staff hide and show it on one shoot', async () => {
    service.setShootStandingEditorNotesHidden.mockResolvedValueOnce(standing({ hidden: true }));
    render(<MemoryRouter><StandingEditorNotesCard shootId={42} clientId={9} value={standing()} canManage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Open client account/ })).toHaveAttribute('href', '/accounts?account=9');

    fireEvent.click(screen.getByRole('button', { name: 'Hide on this shoot' }));
    await waitFor(() => expect(screen.getByText('Hidden on this shoot')).toBeInTheDocument());
    expect(service.setShootStandingEditorNotesHidden).toHaveBeenCalledWith(42, true);
    expect(screen.getByRole('button', { name: 'Show on this shoot' })).toBeInTheDocument();
  });

  it('keeps hidden instructions out of the overview', () => {
    render(<StandingEditorNotesCard shootId={42} value={standing({ hidden: true })} canManage={false} overview />);
    expect(screen.queryByText(grass.content)).not.toBeInTheDocument();
  });

  it('renders nothing when no standing note applies', () => {
    const { container } = render(<StandingEditorNotesCard shootId={42} value={standing({ notes: [] })} canManage />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('booking banner', () => {
  it('lists the notes that will go out and lets staff skip them for this booking', async () => {
    service.fetchClientStandingEditorNotes.mockResolvedValueOnce({
      client: { id: 9, name: 'Dana', company_name: 'Weichert Realtors' }, client_note: null, applicable: [grass],
    });
    const setSkipped = vi.fn();
    render(<StandingEditorNotesBookingBanner clientId="9" skip={{ enabled: true, skipped: false, setSkipped }} />);
    expect(await screen.findByText(grass.content)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Don’t apply on this shoot' }));
    expect(setSkipped).toHaveBeenCalledWith(true);
    expect(service.fetchClientStandingEditorNotes).toHaveBeenCalledWith('9');
  });

  it('stays out of the way for clients with no standing note', async () => {
    service.fetchClientStandingEditorNotes.mockResolvedValueOnce({
      client: { id: 9, name: 'Dana', company_name: null }, client_note: null, applicable: [],
    });
    const { container } = render(<StandingEditorNotesBookingBanner clientId="9" />);
    await waitFor(() => expect(service.fetchClientStandingEditorNotes).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('helpers', () => {
  it('parses shoot payloads defensively and suggests a brokerage keyword', async () => {
    const { parseShootStandingEditorNotes, suggestCompanyKeyword } = await vi.importActual<typeof import('@/services/standingEditorNoteService')>('@/services/standingEditorNoteService');
    expect(parseShootStandingEditorNotes(undefined)).toBeNull();
    expect(parseShootStandingEditorNotes({ hidden: true, notes: [grass, { id: 'bad' }] }))
      .toEqual({ hidden: true, frozen: false, notes: [grass] });
    expect(suggestCompanyKeyword('Weichert, Realtors – Cherry Hill')).toBe('Weichert');
    expect(suggestCompanyKeyword('Long & Foster')).toBe('Long');
    expect(suggestCompanyKeyword(null)).toBe('');
  });
});
