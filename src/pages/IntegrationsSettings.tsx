import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';

// Import these conditionally or use them only in the full page component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api';
import API_ROUTES from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, Home, Upload, Layers, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

// Export the content component for use in Settings page
export const IntegrationsSettingsContent = () => {
  const { toast } = useToast();

  // Zillow/Bridge Settings
  const [zillowSettings, setZillowSettings] = useState({
    clientId: '',
    clientSecret: '',
    serverToken: '',
    browserToken: '',
    enabled: true,
  });
  const [testingZillow, setTestingZillow] = useState(false);
  const [zillowTestResult, setZillowTestResult] = useState<any>(null);

  // Bright MLS Settings
  const [brightMlsSettings, setBrightMlsSettings] = useState({
    apiUrl: '',
    apiUser: '',
    apiKey: '',
    vendorId: '',
    vendorName: '',
    defaultDocVisibility: 'private',
    enabled: true,
  });
  const [testingBrightMls, setTestingBrightMls] = useState(false);
  const [brightMlsTestResult, setBrightMlsTestResult] = useState<any>(null);

  // iGUIDE Settings
  const [iguideSettings, setIguideSettings] = useState({
    apiUsername: '',
    apiPassword: '',
    apiKey: '',
    enabled: true,
  });
  const [testingIguide, setTestingIguide] = useState(false);
  const [iguideTestResult, setIguideTestResult] = useState<any>(null);

  // Dropbox Settings
  const [dropboxSettings, setDropboxSettings] = useState({
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    enabled: false,
  });
  const [testingDropbox, setTestingDropbox] = useState(false);
  const [dropboxTestResult, setDropboxTestResult] = useState<any>(null);

  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Try to load from database settings first
      try {
        const [zillowRes, brightMlsRes, iguideRes, dropboxRes] = await Promise.all([
          apiClient.get(API_ROUTES.admin.settings.get('integrations.zillow')).catch(() => null),
          apiClient.get(API_ROUTES.admin.settings.get('integrations.bright_mls')).catch(() => null),
          apiClient.get(API_ROUTES.admin.settings.get('integrations.iguide')).catch(() => null),
          apiClient.get(API_ROUTES.admin.settings.get('integrations.dropbox')).catch(() => null),
        ]);

        if (zillowRes?.data?.success && zillowRes.data.data?.value) {
          setZillowSettings({ ...zillowRes.data.data.value, enabled: zillowRes.data.data.value.enabled ?? true });
        }

        if (brightMlsRes?.data?.success && brightMlsRes.data.data?.value) {
          setBrightMlsSettings({ ...brightMlsRes.data.data.value, enabled: brightMlsRes.data.data.value.enabled ?? true });
        }

        if (iguideRes?.data?.success && iguideRes.data.data?.value) {
          setIguideSettings({ ...iguideRes.data.data.value, enabled: iguideRes.data.data.value.enabled ?? true });
        }

        if (dropboxRes?.data?.success && dropboxRes.data.data?.value) {
          setDropboxSettings({ ...dropboxRes.data.data.value, enabled: dropboxRes.data.data.value.enabled ?? false });
        }
      } catch (err) {
        console.warn('Could not load settings from database, using defaults');
      }

      // Fallback to defaults if not found in DB
      if (!zillowSettings.clientId) {
        setZillowSettings({
          clientId: '',
          clientSecret: '',
          serverToken: '',
          browserToken: '',
          enabled: true,
        });
      }

      if (!brightMlsSettings.apiUrl) {
        setBrightMlsSettings({
          apiUrl: 'https://bright-manifestservices.tst.brightmls.com',
          apiUser: '',
          apiKey: '',
          vendorId: '',
          vendorName: 'Repro Photos',
          defaultDocVisibility: 'private',
          enabled: true,
        });
      }

      if (!iguideSettings.apiUsername && !iguideSettings.apiKey) {
        setIguideSettings({
          apiUsername: '',
          apiPassword: '',
          apiKey: '',
          enabled: true,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save Zillow settings
      await apiClient.post(API_ROUTES.admin.settings.store, {
        key: 'integrations.zillow',
        value: zillowSettings,
        type: 'json',
        description: 'Zillow/Bridge Data Output API credentials',
      });

      // Save Bright MLS settings
      await apiClient.post(API_ROUTES.admin.settings.store, {
        key: 'integrations.bright_mls',
        value: brightMlsSettings,
        type: 'json',
        description: 'Bright MLS API credentials',
      });

      // Save iGUIDE settings
      await apiClient.post(API_ROUTES.admin.settings.store, {
        key: 'integrations.iguide',
        value: iguideSettings,
        type: 'json',
        description: 'iGUIDE API credentials',
      });

      // Save Dropbox settings
      await apiClient.post(API_ROUTES.admin.settings.store, {
        key: 'integrations.dropbox',
        value: dropboxSettings,
        type: 'json',
        description: 'Dropbox storage integration',
      });

      toast({
        title: "Settings saved",
        description: "Integration settings have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testZillowConnection = async () => {
    setTestingZillow(true);
    setZillowTestResult(null);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.testConnection, {
        service: 'zillow',
      });
      setZillowTestResult(response.data);
    } catch (error: any) {
      setZillowTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed',
      });
    } finally {
      setTestingZillow(false);
    }
  };

  const testBrightMlsConnection = async () => {
    setTestingBrightMls(true);
    setBrightMlsTestResult(null);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.testConnection, {
        service: 'bright_mls',
      });
      setBrightMlsTestResult(response.data);
    } catch (error: any) {
      setBrightMlsTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed',
      });
    } finally {
      setTestingBrightMls(false);
    }
  };

  const testIguideConnection = async () => {
    setTestingIguide(true);
    setIguideTestResult(null);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.testConnection, {
        service: 'iguide',
      });
      setIguideTestResult(response.data);
    } catch (error: any) {
      setIguideTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed',
      });
    } finally {
      setTestingIguide(false);
    }
  };

  const testDropboxConnection = async () => {
    setTestingDropbox(true);
    setDropboxTestResult(null);
    try {
      const response = await apiClient.post(API_ROUTES.integrations.testConnection, {
        service: 'dropbox',
      });
      setDropboxTestResult(response.data);
    } catch (error: any) {
      setDropboxTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed',
      });
    } finally {
      setTestingDropbox(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="zillow" className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-4">
              <TabsTrigger value="dropbox">
                <Upload className="mr-2 h-4 w-4" />
                Dropbox
              </TabsTrigger>
              <TabsTrigger value="zillow">
                <Home className="mr-2 h-4 w-4" />
                Zillow
              </TabsTrigger>
              <TabsTrigger value="bright_mls">
                <Layers className="mr-2 h-4 w-4" />
                Bright MLS
              </TabsTrigger>
              <TabsTrigger value="iguide">
                <Settings2 className="mr-2 h-4 w-4" />
                iGUIDE
              </TabsTrigger>
            </TabsList>

            {/* Dropbox Storage Settings */}
            <TabsContent value="dropbox" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dropbox Storage</CardTitle>
                      <CardDescription>
                        Configure Dropbox for photo storage. When enabled, uploads go to Dropbox. When disabled, local storage is used.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="dropbox-enabled">Enabled</Label>
                      <Switch
                        id="dropbox-enabled"
                        checked={dropboxSettings.enabled}
                        onCheckedChange={(checked) =>
                          setDropboxSettings({ ...dropboxSettings, enabled: checked })
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 mb-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Storage Mode:</strong> {dropboxSettings.enabled ? 'Dropbox Cloud Storage' : 'Local Server Storage'}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {dropboxSettings.enabled 
                        ? 'Photos will be uploaded to Dropbox folders organized by shoot address.' 
                        : 'Photos will be stored locally on the server.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dropbox-client-id">App Key (Client ID)</Label>
                      <Input
                        id="dropbox-client-id"
                        type="text"
                        value={dropboxSettings.clientId}
                        onChange={(e) =>
                          setDropboxSettings({ ...dropboxSettings, clientId: e.target.value })
                        }
                        placeholder="Enter Dropbox App Key"
                        disabled={!dropboxSettings.enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dropbox-client-secret">App Secret</Label>
                      <Input
                        id="dropbox-client-secret"
                        type="password"
                        value={dropboxSettings.clientSecret}
                        onChange={(e) =>
                          setDropboxSettings({ ...dropboxSettings, clientSecret: e.target.value })
                        }
                        placeholder="Enter Dropbox App Secret"
                        disabled={!dropboxSettings.enabled}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="dropbox-access-token">Access Token</Label>
                      <Input
                        id="dropbox-access-token"
                        type="password"
                        value={dropboxSettings.accessToken}
                        onChange={(e) =>
                          setDropboxSettings({ ...dropboxSettings, accessToken: e.target.value })
                        }
                        placeholder="Enter Dropbox Access Token"
                        disabled={!dropboxSettings.enabled}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="dropbox-refresh-token">Refresh Token (Optional)</Label>
                      <Input
                        id="dropbox-refresh-token"
                        type="password"
                        value={dropboxSettings.refreshToken}
                        onChange={(e) =>
                          setDropboxSettings({ ...dropboxSettings, refreshToken: e.target.value })
                        }
                        placeholder="Enter Dropbox Refresh Token (for automatic token refresh)"
                        disabled={!dropboxSettings.enabled}
                      />
                    </div>
                  </div>

                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Folder Structure:</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li>• RAW uploads: <code>/Photo Editing/To-Do/[shoot-address]/raw/</code></li>
                      <li>• Extra photos: <code>/Photo Editing/To-Do/[shoot-address]/extra/</code></li>
                      <li>• Edited photos: <code>/Photo Editing/Completed/[shoot-address]-edited/</code></li>
                    </ul>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Test Connection</p>
                      <p className="text-xs text-muted-foreground">
                        Verify your Dropbox credentials are working
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={testDropboxConnection}
                      disabled={testingDropbox || !dropboxSettings.enabled}
                    >
                      {testingDropbox ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>

                  {dropboxTestResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        dropboxTestResult.success
                          ? 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
                          : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'
                      }`}
                    >
                      {dropboxTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <p className="text-sm">
                        {dropboxTestResult.message || dropboxTestResult.data?.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Zillow/Bridge Settings */}
            <TabsContent value="zillow" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Zillow / Bridge Data Output</CardTitle>
                      <CardDescription>
                        Configure API credentials for property data lookup
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="zillow-enabled">Enabled</Label>
                      <Switch
                        id="zillow-enabled"
                        checked={zillowSettings.enabled}
                        onCheckedChange={(checked) =>
                          setZillowSettings({ ...zillowSettings, enabled: checked })
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zillow-client-id">Client ID</Label>
                      <Input
                        id="zillow-client-id"
                        type="text"
                        value={zillowSettings.clientId}
                        onChange={(e) =>
                          setZillowSettings({ ...zillowSettings, clientId: e.target.value })
                        }
                        placeholder="Enter Client ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zillow-client-secret">Client Secret</Label>
                      <Input
                        id="zillow-client-secret"
                        type="password"
                        value={zillowSettings.clientSecret}
                        onChange={(e) =>
                          setZillowSettings({ ...zillowSettings, clientSecret: e.target.value })
                        }
                        placeholder="Enter Client Secret"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zillow-server-token">Server Token</Label>
                      <Input
                        id="zillow-server-token"
                        type="password"
                        value={zillowSettings.serverToken}
                        onChange={(e) =>
                          setZillowSettings({ ...zillowSettings, serverToken: e.target.value })
                        }
                        placeholder="Enter Server Token"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zillow-browser-token">Browser Token</Label>
                      <Input
                        id="zillow-browser-token"
                        type="password"
                        value={zillowSettings.browserToken}
                        onChange={(e) =>
                          setZillowSettings({ ...zillowSettings, browserToken: e.target.value })
                        }
                        placeholder="Enter Browser Token"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Test Connection</p>
                      <p className="text-xs text-muted-foreground">
                        Verify your credentials are working
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={testZillowConnection}
                      disabled={testingZillow || !zillowSettings.enabled}
                    >
                      {testingZillow ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>

                  {zillowTestResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        zillowTestResult.success
                          ? 'bg-green-50 text-green-900'
                          : 'bg-red-50 text-red-900'
                      }`}
                    >
                      {zillowTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <p className="text-sm">
                        {zillowTestResult.message || zillowTestResult.data?.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bright MLS Settings */}
            <TabsContent value="bright_mls" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Bright MLS</CardTitle>
                      <CardDescription>
                        Configure API credentials for MLS media publishing
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bright-mls-enabled">Enabled</Label>
                      <Switch
                        id="bright-mls-enabled"
                        checked={brightMlsSettings.enabled}
                        onCheckedChange={(checked) =>
                          setBrightMlsSettings({ ...brightMlsSettings, enabled: checked })
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-api-url">API URL</Label>
                      <Input
                        id="bright-mls-api-url"
                        type="text"
                        value={brightMlsSettings.apiUrl}
                        onChange={(e) =>
                          setBrightMlsSettings({ ...brightMlsSettings, apiUrl: e.target.value })
                        }
                        placeholder="https://bright-manifestservices.tst.brightmls.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-api-user">API User</Label>
                      <Input
                        id="bright-mls-api-user"
                        type="text"
                        value={brightMlsSettings.apiUser}
                        onChange={(e) =>
                          setBrightMlsSettings({ ...brightMlsSettings, apiUser: e.target.value })
                        }
                        placeholder="Enter API User"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-api-key">API Key</Label>
                      <Input
                        id="bright-mls-api-key"
                        type="password"
                        value={brightMlsSettings.apiKey}
                        onChange={(e) =>
                          setBrightMlsSettings({ ...brightMlsSettings, apiKey: e.target.value })
                        }
                        placeholder="Enter API Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-vendor-id">Vendor ID</Label>
                      <Input
                        id="bright-mls-vendor-id"
                        type="text"
                        value={brightMlsSettings.vendorId}
                        onChange={(e) =>
                          setBrightMlsSettings({ ...brightMlsSettings, vendorId: e.target.value })
                        }
                        placeholder="Enter Vendor ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-vendor-name">Vendor Name</Label>
                      <Input
                        id="bright-mls-vendor-name"
                        type="text"
                        value={brightMlsSettings.vendorName}
                        onChange={(e) =>
                          setBrightMlsSettings({ ...brightMlsSettings, vendorName: e.target.value })
                        }
                        placeholder="Repro Photos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bright-mls-doc-visibility">Default Doc Visibility</Label>
                      <select
                        id="bright-mls-doc-visibility"
                        value={brightMlsSettings.defaultDocVisibility}
                        onChange={(e) =>
                          setBrightMlsSettings({
                            ...brightMlsSettings,
                            defaultDocVisibility: e.target.value,
                          })
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      >
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Test Connection</p>
                      <p className="text-xs text-muted-foreground">
                        Verify your credentials are working
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={testBrightMlsConnection}
                      disabled={testingBrightMls || !brightMlsSettings.enabled}
                    >
                      {testingBrightMls ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>

                  {brightMlsTestResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        brightMlsTestResult.success
                          ? 'bg-green-50 text-green-900'
                          : 'bg-red-50 text-red-900'
                      }`}
                    >
                      {brightMlsTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <p className="text-sm">
                        {brightMlsTestResult.message || brightMlsTestResult.data?.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* iGUIDE Settings */}
            <TabsContent value="iguide" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>iGUIDE</CardTitle>
                      <CardDescription>
                        Configure API credentials for 3D tour and floorplan syncing
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="iguide-enabled">Enabled</Label>
                      <Switch
                        id="iguide-enabled"
                        checked={iguideSettings.enabled}
                        onCheckedChange={(checked) =>
                          setIguideSettings({ ...iguideSettings, enabled: checked })
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="iguide-api-username">API Username</Label>
                      <Input
                        id="iguide-api-username"
                        type="text"
                        value={iguideSettings.apiUsername}
                        onChange={(e) =>
                          setIguideSettings({ ...iguideSettings, apiUsername: e.target.value })
                        }
                        placeholder="Enter API Username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iguide-api-password">API Password</Label>
                      <Input
                        id="iguide-api-password"
                        type="password"
                        value={iguideSettings.apiPassword}
                        onChange={(e) =>
                          setIguideSettings({ ...iguideSettings, apiPassword: e.target.value })
                        }
                        placeholder="Enter API Password"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="iguide-api-key">API Key (Alternative)</Label>
                      <Input
                        id="iguide-api-key"
                        type="password"
                        value={iguideSettings.apiKey}
                        onChange={(e) =>
                          setIguideSettings({ ...iguideSettings, apiKey: e.target.value })
                        }
                        placeholder="Enter API Key (optional, if using key-based auth)"
                      />
                    </div>
                  </div>

                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Webhook URL:</strong>{' '}
                      {window.location.origin}/iguide_webhook.php
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure this URL in your iGUIDE account settings to receive automatic
                      updates.
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Test Connection</p>
                      <p className="text-xs text-muted-foreground">
                        Verify your credentials are working
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={testIguideConnection}
                      disabled={testingIguide || !iguideSettings.enabled}
                    >
                      {testingIguide ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>

                  {iguideTestResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        iguideTestResult.success
                          ? 'bg-green-50 text-green-900'
                          : 'bg-red-50 text-red-900'
                      }`}
                    >
                      {iguideTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <p className="text-sm">
                        {iguideTestResult.message || iguideTestResult.data?.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4 pt-6">
            <Button variant="outline" onClick={loadSettings}>
              Reset
            </Button>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
    </div>
  );
};

// Full page component for direct navigation
const IntegrationsSettings = () => {
  const { role } = useAuth();

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Settings"
            title="Integrations"
            description="Configure API credentials and settings for external integrations"
          />
          <IntegrationsSettingsContent />
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default IntegrationsSettings;


