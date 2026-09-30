import type { ShootData } from '@/types/shoots';
import { ShootUnitScopeBar } from './ShootUnitScope';

/**
 * Overview-style unit chrome for Shoot Details left/content panels.
 * Mount at the top of the panel body (not as a full-width strip above tabs).
 */
export function ShootDetailsPanelUnitChrome({
  shoot,
  disabled = false,
}: {
  shoot: ShootData;
  disabled?: boolean;
}) {
  return (
    <div className="mb-2 shrink-0" data-testid="shoot-details-panel-unit-chrome">
      <ShootUnitScopeBar shoot={shoot} variant="embedded" disabled={disabled} />
    </div>
  );
}
