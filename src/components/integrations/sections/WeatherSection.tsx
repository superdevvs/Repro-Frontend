import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CloudSun, MapPinned } from 'lucide-react';

export function WeatherSection() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Weather provider</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            Active
          </Badge>
        </div>
        <CardDescription>
          In-app weather is routed through the backend so provider keys stay off the client and
          lookups can fall back automatically when the primary provider is unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-4">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CloudSun className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Google Weather API with fallback</p>
            <p className="text-xs text-muted-foreground">
              Current conditions and forecasts use Google Weather first, then fall back to
              coordinate-based forecast data when Google Weather is unavailable for the configured key.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/60 px-4 py-4 text-xs text-muted-foreground">
          <MapPinned className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            Booking, dashboard cards, shoot detail views, and the navbar all use the same backend
            lookup now, so weather stays consistent and browser-side vendor errors are avoided.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
