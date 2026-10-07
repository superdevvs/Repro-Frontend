import type { TravelTransition } from './types';

export function TravelRouteSummary({ leg }: { leg: TravelTransition }) {
  return <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
    <p className="font-medium">{leg.distance_miles != null ? `${leg.distance_miles.toFixed(1)} miles · ` : ''}{leg.source === 'google_routes' && leg.drive_minutes != null
      ? `Google suggests ${Math.ceil(leg.drive_minutes)} min` : leg.source === 'same_building' ? 'Same building · no drive'
        : leg.source === 'fixed' ? 'Fixed travel allowance' : leg.source === 'mileage_band' ? 'Distance-based estimate' : 'Travel estimate unavailable'}</p>
    <p className="mt-1 text-muted-foreground">{leg.required_minutes == null ? 'Staff review required' : `${leg.required_minutes} min recommended with buffer`} · {Math.max(0, leg.available_minutes)} min gap{leg.shortfall_minutes && leg.shortfall_minutes > 0 ? ` · ${leg.shortfall_minutes} min short` : ''}</p>
    {leg.attribution && <p translate="no" className="mt-1 whitespace-nowrap text-xs font-normal not-italic text-[#5E5E5E] dark:text-white">{leg.attribution}</p>}
  </div>;
}
