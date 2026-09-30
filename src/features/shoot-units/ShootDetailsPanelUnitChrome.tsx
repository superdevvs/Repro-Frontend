import type { ShootData } from '@/types/shoots';
import { ShootUnitScopeBar } from './ShootUnitScope';

/**
 * Unit chrome for Shoot Details left/content panels — flush under the tab row.
 * Uses variant="panel" (same controls as Overview embedded, without Location
 * top-rule spacing). Do not mount as a full-width strip above tabs.
 */
export function ShootDetailsPanelUnitChrome({
  shoot,
  disabled = false,
}: {
  shoot: ShootData;
  disabled?: boolean;
}) {
  return (
    <div className="mb-1.5 shrink-0" data-testid="shoot-details-panel-unit-chrome">
      <ShootUnitScopeBar shoot={shoot} variant="panel" disabled={disabled} />
    </div>
  );
}
