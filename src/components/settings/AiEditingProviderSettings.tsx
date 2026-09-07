import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { studioError } from '@/services/studioWorkspaceService';
import { studioProviderService, type StudioProviderSettings, type StudioProviderUpdate, type StudioServiceRoute } from '@/services/studioProviderService';

const PHOTO_SERVICES = new Set(['listing-ready', 'color-correction', 'full-shoot', 'sky-replacement', 'perspective-correction']);
const routePayload = (services: StudioServiceRoute[]) => services.map(({ id, provider, model, fallback }) => ({ id, provider, model, ...(id === 'outpaint' ? { fallback: fallback ?? null } : {}) }));
const selectClass = 'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm';

/** Credentials and provider names are available only in this Superadmin settings view. */
export function AiEditingProviderSettings() {
  const { role } = useAuth();
  return role === 'superadmin' ? <ProviderSettingsForm /> : null;
}

function ProviderSettingsForm() {
  const [saved, setSaved] = useState<StudioProviderSettings | null>(null);
  const [services, setServices] = useState<StudioServiceRoute[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = saved !== null && JSON.stringify(routePayload(services)) !== JSON.stringify(routePayload(saved.services));
  const configured = Boolean(saved?.credentials.fotello.keyConfigured && saved?.credentials.fotello.teamIdConfigured);

  const load = async () => {
    setLoading(true); setError('');
    try { const next = await studioProviderService.settings(); setSaved(next); setServices(next.services); }
    catch (reason) { setError(studioError(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { let active = true; void studioProviderService.settings().then(next => { if (active) { setSaved(next); setServices(next.services); } }).catch(reason => { if (active) setError(studioError(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  const save = async (input: StudioProviderUpdate, credentialsOnly = false) => {
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const next = await studioProviderService.save(input);
      setSaved(next);
      // Saving a key must neither switch routes nor discard pending route choices.
      if (!credentialsOnly) setServices(next.services);
      else setServices(current => next.services.map(service => { const draft = current.find(item => item.id === service.id); return draft ? { ...service, provider: draft.provider, model: draft.model, fallback: draft.fallback } : service; }));
      if (credentialsOnly) { setApiKey(''); setTeamId(''); }
      setNotice(credentialsOnly ? 'Connection details saved. Service routing is unchanged.' : 'Service routing saved. New jobs will use these choices.');
    } catch (reason) { setError(studioError(reason)); }
    finally { setSaving(false); }
  };
  const update = (id: string, changes: Partial<StudioServiceRoute>) => { setServices(current => current.map(service => service.id === id ? { ...service, ...changes } : service)); setNotice(''); };
  const usePhotoProvider = () => {
    setServices(current => current.map(service => {
      const option = service.providers.find(provider => provider.id === 'fotello');
      const model = option?.models.find(item => item.ready !== false);
      return PHOTO_SERVICES.has(service.id) && option && model ? { ...service, provider: option.id, model: model.id } : service;
    }));
    setNotice('Available enhancement choices updated. Save service routing to apply them. Services that are not ready keep their current API.');
  };

  if (loading) return <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading AI Editing settings…</div>;
  if (!saved) return <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-5"><p>{error || 'AI Editing settings could not be loaded.'}</p><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>;

  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">AI Editing</h2><p className="mt-1 text-sm text-muted-foreground">Choose the API and model for each service. Existing jobs keep their original provider.</p></div>
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><ShieldCheck className="h-4 w-4 shrink-0" />Superadmin settings · AI Editing remains unavailable to clients.</div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">{notice}</p>}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Fotello connection</CardTitle><CardDescription>Save an API key now and add the team ID when available. Saving credentials does not change any service provider.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>{saved.credentials.fotello.keyConfigured ? 'API key saved' : 'API key needed'}</span><span>{saved.credentials.fotello.teamIdConfigured ? 'Team ID saved' : 'Team ID pending'}</span></div>
        <form onSubmit={event => { event.preventDefault(); const credentials = { ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(teamId.trim() ? { teamId: teamId.trim() } : {}) }; if (Object.keys(credentials).length) void save({ credentials: { fotello: credentials } }, true); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium"><span>API key</span><Input type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={saved.credentials.fotello.keyConfigured ? 'Leave blank to keep saved key' : 'Enter API key'} disabled={saving} /></label>
            <label className="space-y-2 text-sm font-medium"><span>Team ID</span><Input type="password" autoComplete="off" value={teamId} onChange={event => setTeamId(event.target.value)} placeholder={saved.credentials.fotello.teamIdConfigured ? 'Leave blank to keep saved team ID' : 'Optional — add when available'} disabled={saving} /></label>
          </div>
          <p className="text-xs text-muted-foreground">Saved values are never displayed. Blank fields keep the current values.</p>
          <Button type="submit" variant="outline" disabled={saving || (!apiKey.trim() && !teamId.trim())}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save connection details</Button>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">Service routing</CardTitle><CardDescription className="mt-1">Use the available model options for each API. Readiness reflects saved configuration.</CardDescription></div><Button variant="outline" disabled={!configured || saving} onClick={usePhotoProvider}>Use Fotello for enhancement</Button></CardHeader>
      <CardContent className="space-y-4">
        {!configured && <p className="text-sm text-muted-foreground">Photo routing can stay on the current API until both connection details are saved.</p>}
        <p className="text-sm text-muted-foreground">Fotello enhancement is available after setup. Other routes need verified settings or a result-retrieval contract before use. Unavailable choices stay disabled; existing APIs remain available.</p>
        {services.map(service => {
          const stored = saved.services.find(item => item.id === service.id);
          const changed = stored?.provider !== service.provider || stored?.model !== service.model || JSON.stringify(stored?.fallback) !== JSON.stringify(service.fallback);
          const provider = service.providers.find(item => item.id === service.provider);
          const fallbackProvider = service.providers.find(item => item.id === service.fallback?.provider);
          return <div key={service.id} className="rounded-xl border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{service.label}</h3><span className={`flex items-center gap-1.5 text-xs ${!changed && service.ready ? 'text-primary' : 'text-muted-foreground'}`}>{!changed && service.ready && <CheckCircle2 className="h-3.5 w-3.5" />}{changed ? 'Unsaved choice' : service.ready ? 'Configured' : 'Not ready'}</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs text-muted-foreground"><span>API</span><select aria-label={`${service.label} API`} className={selectClass} disabled={saving} value={service.provider} onChange={event => { const option = service.providers.find(item => item.id === event.target.value); const model = option?.models.find(item => item.ready !== false); if (option && model) update(service.id, { provider: option.id, model: model.id }); }}>{service.providers.map(option => <option key={option.id} value={option.id} disabled={option.models.every(model => model.ready === false)}>{option.label}{option.models.every(model => model.ready === false) ? " — Not ready" : ""}</option>)}</select></label>
              <label className="space-y-1.5 text-xs text-muted-foreground"><span>Model</span><select aria-label={`${service.label} model`} className={selectClass} disabled={saving || !provider?.models.length} value={service.model} onChange={event => update(service.id, { model: event.target.value })}>{provider?.models.map(model => <option key={model.id} value={model.id} disabled={model.ready === false}>{model.label}</option>)}</select></label>
            </div>
            {!changed && !service.ready && service.reason && <p className="mt-2 text-xs text-muted-foreground">{service.reason}</p>}
            {service.providers.filter(option => option.models.every(model => model.ready === false)).map(option => <p key={option.id} className="mt-2 text-xs text-muted-foreground">{option.label}: {option.models[0]?.reason || 'This API is not ready for this service.'}</p>)}
            {service.id === 'outpaint' && <div className="mt-4 border-t pt-3"><p className="mb-2 text-xs font-medium">AI Extend fallback</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-muted-foreground"><span>Fallback API</span><select aria-label="AI Extend fallback API" className={selectClass} disabled={saving} value={service.fallback?.provider || ''} onChange={event => { const option = service.providers.find(item => item.id === event.target.value); update(service.id, { fallback: option?.models.length ? { provider: option.id, model: option.models[0].id } : null }); }}><option value="">No fallback</option>{service.providers.filter(option => option.id === 'openai').map(option => <option key={option.id} value={option.id} disabled={option.models.every(model => model.ready === false)}>{option.label}{option.models.every(model => model.ready === false) ? " — Not ready" : ""}</option>)}</select></label>{service.fallback && <label className="space-y-1.5 text-xs text-muted-foreground"><span>Fallback model</span><select aria-label="AI Extend fallback model" className={selectClass} disabled={saving} value={service.fallback.model} onChange={event => update(service.id, { fallback: { provider: service.fallback!.provider, model: event.target.value } })}>{fallbackProvider?.models.map(model => <option key={model.id} value={model.id} disabled={model.ready === false}>{model.label}</option>)}</select></label>}</div></div>}
          </div>;
        })}
        <div className="flex flex-wrap items-center gap-3"><Button disabled={saving || !dirty} onClick={() => void save({ services: routePayload(services) })}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save service routing</Button><span className="text-xs text-muted-foreground">Applies to new jobs only.</span></div>
      </CardContent>
    </Card>
  </div>;
}
