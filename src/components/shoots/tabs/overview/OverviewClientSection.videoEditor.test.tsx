import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { OverviewClientSection } from './OverviewClientSection';

afterEach(cleanup);

const mount = (permission?: boolean, isEditMode = false) => render(<OverviewClientSection
  shoot={{ id: '42', canViewVideoEditorContext: permission, client: { id: '12', name: 'Jordan Client', email: 'private@example.test', phone: '555-0100' } } as ShootData}
  isEditMode={isEditMode} isAdmin={false} isRep={false} isPhotographer={false} isEditor isClient={false}
  shouldHideClientDetails clients={[]} selectedClientId="12" clientSearchOpen={false}
  setClientSearchOpen={vi.fn()} setSelectedClientId={vi.fn()} updateField={vi.fn()}
/>);

describe('Overview video editor client name', () => {
  it.each([false, true])('shows only an authorized client name and offers no editing (edit mode %s)', editMode => {
    mount(true, editMode);
    expect(screen.getByText('Jordan Client')).toBeVisible();
    expect(screen.queryByText('private@example.test')).toBeNull();
    expect(screen.queryByText('555-0100')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it.each([false, undefined])('hides client identity when server authorization is %s', permission => {
    mount(permission);
    expect(screen.queryByText('Jordan Client')).toBeNull();
  });
});
