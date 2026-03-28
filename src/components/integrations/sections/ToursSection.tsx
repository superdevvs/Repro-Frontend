import React, { useEffect, useState } from 'react';
import { Box, Boxes, ExternalLink, HomeIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';

type ToursSectionProps = {
  onOpenSettings?: () => void;
};

type TourProviderSummary = {
  id: string;
  label: string;
  description: string;
  status: 'connected' | 'not_connected' | 'external_only';
  detail: string;
  icon: React.ReactNode;
};

const statusBadgeClassNames: Record<TourProviderSummary['status'], string> = {
  connected: 'bg-green-50 text-green-700 border-green-200',
  not_connected: 'bg-amber-50 text-amber-700 border-amber-200',
  external_only: 'bg-slate-50 text-slate-700 border-slate-200',
};

const statusLabels: Record<TourProviderSummary['status'], string> = {
  connected: 'Configured',
  not_connected: 'Needs setup',
  external_only: 'External workflow',
};

export function ToursSection({ onOpenSettings }: ToursSectionProps) {
  const [loading, setLoading] = useState(true);
  const [iguideConfigured, setIguideConfigured] = useState(false);
  const [iguideEnabled, setIguideEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTourSummary = async () => {
      try {
        const response = await apiClient.get(API_ROUTES.admin.settings.get('integrations.iguide'));
        const value = response?.data?.data?.value ?? {};
        const configured = Boolean(value?.apiUsername || value?.apiPassword || value?.apiKey);

        if (!mounted) {
          return;
        }

        setIguideConfigured(configured);
        setIguideEnabled(Boolean(value?.enabled ?? configured));
      } catch {
        if (!mounted) {
          return;
        }

        setIguideConfigured(false);
        setIguideEnabled(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadTourSummary();

    return () => {
      mounted = false;
    };
  }, []);

  const providers: TourProviderSummary[] = [
    {
      id: 'iguide',
      label: 'iGUIDE',
      description: '3D tours, branded links, MLS links, and floor plan sync.',
      status: iguideConfigured && iguideEnabled ? 'connected' : 'not_connected',
      detail: iguideConfigured
        ? iguideEnabled
          ? 'Configured through the saved API credentials below.'
          : 'Credentials exist, but the integration is currently disabled.'
        : 'No saved API credentials were found in the integrations editor.',
      icon: <Box className="h-4 w-4" />,
    },
    {
      id: 'matterport',
      label: 'Matterport',
      description: '3D space capture and hosted showcase links.',
      status: 'external_only',
      detail: 'This app does not persist Matterport credentials yet. Manage vendor setup outside the app.',
      icon: <Boxes className="h-4 w-4" />,
    },
    {
      id: 'cubicasa',
      label: 'CubiCasa',
      description: 'Floor plan generation service.',
      status: 'external_only',
      detail: 'This app does not persist CubiCasa credentials yet. Use the vendor workflow until in-app setup exists.',
      icon: <HomeIcon className="h-4 w-4" />,
    },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>3D Tours</CardTitle>
        <CardDescription>
          Review which tour providers have real saved configuration and jump into the API-backed editor when changes are needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tour integration summary...
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">{provider.icon}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                    <Badge variant="outline" className={statusBadgeClassNames[provider.status]}>
                      {statusLabels[provider.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                  <p className="text-xs text-muted-foreground">{provider.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Need to change credentials or enable a provider?</p>
            <p className="text-xs text-muted-foreground">
              Use the integrations editor below. Demo-style toggles were removed so saved settings stay authoritative.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onOpenSettings}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open API Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
