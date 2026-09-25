import { apiClient } from './api';

export interface StudioServiceAvailability { ready: boolean; reason?: string }
export interface StudioCapabilities {
  presets: Record<string, StudioServiceAvailability>;
  revision: StudioServiceAvailability & { referenceImages: boolean };
  upscale: StudioServiceAvailability;
  outpaint: StudioServiceAvailability;
}
export interface StudioModelOption { id: string; label: string; ready?: boolean; reason?: string }
export interface StudioProviderOption { id: string; label: string; models: StudioModelOption[] }
export interface StudioServiceRoute {
  id: string; label: string; provider: string; model: string; ready: boolean; reason?: string;
  providers: StudioProviderOption[];
  fallback?: { provider: string; model: string } | null;
}
export interface VirtualStagingUsage { stagingUsed: number; stagingLimit: number | string; checkedAt: string }
export interface StudioProviderSettings {
  services: StudioServiceRoute[];
  credentials: {
    autoenhance?: { keyConfigured: boolean; webhookConfigured: boolean };
    fotello: { keyConfigured: boolean; teamIdConfigured: boolean };
    virtualStagingAi: { keyConfigured: boolean; usage: VirtualStagingUsage | null };
  };
}
export interface StudioProviderUpdate {
  services?: { id: string; provider: string; model: string; fallback?: { provider: string; model: string } | null }[];
  credentials?: { autoenhance?: { apiKey?: string; webhookSecret?: string }; fotello?: { apiKey?: string; teamId?: string }; virtualStagingAi?: { apiKey?: string; refresh?: boolean } };
}

export const studioProviderService = {
  async settings(): Promise<StudioProviderSettings> { return (await apiClient.get('/studio/provider-settings')).data.data; },
  async save(input: StudioProviderUpdate): Promise<StudioProviderSettings> { return (await apiClient.put('/studio/provider-settings', input)).data.data; },
  async capabilities(): Promise<StudioCapabilities> { return (await apiClient.get('/studio/workspaces/capabilities')).data.data; },
};

/** New operations stay disabled until the server confirms an implemented route. */
export const presetAvailability = (id: string, capabilities?: StudioCapabilities | null): StudioServiceAvailability =>
  capabilities?.presets[id] ?? (['sky-replacement', 'perspective-correction'].includes(id)
    ? { ready: false, reason: 'This edit is not configured yet.' } : { ready: true });
