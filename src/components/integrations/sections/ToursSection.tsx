import React, { useState } from 'react';
import { Box, HomeIcon, Boxes, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';

const tourOptions = [
  {
    id: 'iguide',
    label: 'iGUIDE',
    description: '3D virtual tours and floor plans',
    icon: <Box className="h-4 w-4" />,
    status: 'connected' as const,
  },
  {
    id: 'cubicasa',
    label: 'CubiCasa',
    description: 'Floor plan generation service',
    icon: <HomeIcon className="h-4 w-4" />,
    status: 'connected' as const,
  },
  {
    id: 'matterport',
    label: 'Matterport',
    description: '3D space capture and virtual tours',
    icon: <Boxes className="h-4 w-4" />,
    status: 'not_connected' as const,
  },
];

export function ToursSection() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'superadmin';
  const [autoPublish, setAutoPublish] = useState(true);
  const [clientAccess, setClientAccess] = useState(false);
  
  const handleConnect = (service: string) => {
    toast({
      title: "Connecting to " + service,
      description: "Redirecting to authentication page...",
    });
  };
  
  const handleDisconnect = (service: string) => {
    toast({
      title: "Disconnected " + service,
      description: "The service has been disconnected successfully.",
    });
  };
  
  const handleToggleOption = (service: string, option: string, enabled: boolean) => {
    if (service === 'iGUIDE' && option === 'Auto Publish') {
      setAutoPublish(enabled);
    } else if (service === 'CubiCasa' && option === 'Client Access') {
      setClientAccess(enabled);
    }
    
    toast({
      title: `${option} ${enabled ? 'Enabled' : 'Disabled'} for ${service}`,
      description: `The setting has been updated successfully.`,
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>3D Tours</CardTitle>
        <CardDescription>
          Connect 3D tour and floor plan services to enhance property listings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {tourOptions.map((option) => (
            <div
              key={option.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="rounded-lg bg-primary/10 text-primary p-2 flex-shrink-0">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  {option.status === 'connected' && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 h-5 text-xs">
                      <Check className="h-3 w-3" />
                      Connected
                    </Badge>
                  )}
                  {option.status === 'not_connected' && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 h-5 text-xs">
                      <X className="h-3 w-3" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {option.status === 'connected' && option.id === 'iguide' && isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-publish" className="text-xs text-muted-foreground cursor-pointer">
                      Auto Publish
                    </Label>
                    <Switch
                      id="auto-publish"
                      checked={autoPublish}
                      onCheckedChange={(enabled) => handleToggleOption('iGUIDE', 'Auto Publish', enabled)}
                    />
                  </div>
                )}
                {option.status === 'connected' && option.id === 'cubicasa' && isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="client-access" className="text-xs text-muted-foreground cursor-pointer">
                      Client Access
                    </Label>
                    <Switch
                      id="client-access"
                      checked={clientAccess}
                      onCheckedChange={(enabled) => handleToggleOption('CubiCasa', 'Client Access', enabled)}
                    />
                  </div>
                )}
                {option.status === 'not_connected' && isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleConnect(option.label)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
