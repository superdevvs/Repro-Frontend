import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface AddressProvider {
  id: string;
  name: string;
  description: string;
  requires_api_key: boolean;
  is_open_source: boolean;
  rate_limit: string;
  cost: string;
}

export function AddressAutocompleteSection() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<AddressProvider[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('zillow');
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProviderSettings();
  }, []);

  const fetchProviderSettings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/address/provider`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProvider(data.data.provider);
        setProviders(data.data.available_providers || []);
      }
    } catch (error) {
      console.error('Failed to fetch provider settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load address provider settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (providerId: string) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/address/provider`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ provider: providerId }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentProvider(providerId);
        toast({
          title: 'Success',
          description: `Address provider changed to ${data.data.provider}`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to update address provider',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update provider:', error);
      toast({
        title: 'Error',
        description: 'Failed to update address provider',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    // Note: API key saving would typically be handled via backend settings API
    // For now, this is a placeholder that shows the UI structure
    toast({
      title: 'API Key',
      description: 'API keys are configured in your environment settings. Contact your administrator to update API keys.',
    });
  };

  const selectedProvider = providers.find((p) => p.id === currentProvider);
  const requiresApiKey = selectedProvider?.requires_api_key ?? false;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Address Autocomplete
        </CardTitle>
        <CardDescription>
          Configure the address autocomplete provider for booking shoots
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="provider-select">Provider</Label>
          <Select
            value={currentProvider}
            onValueChange={handleProviderChange}
            disabled={saving}
          >
            <SelectTrigger id="provider-select" className="w-full">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProvider && (
            <p className="text-sm text-muted-foreground">
              {selectedProvider.description}
            </p>
          )}
        </div>

        {requiresApiKey && (
          <div className="space-y-2">
            <Label htmlFor="api-key-input">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key-input"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveApiKey}
                disabled={!apiKey || saving}
                variant="outline"
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              API keys are typically configured in environment settings. Contact your administrator for assistance.
            </p>
          </div>
        )}

        {!requiresApiKey && selectedProvider && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              {selectedProvider.name} does not require an API key and is ready to use.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
