
import React, { useState } from 'react';
import { IntegrationCard } from '../IntegrationCard';
import { FolderIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function StorageSection() {
  const [autoSync, setAutoSync] = useState(true);
  
  const handleDisconnect = (service: string) => {
    toast({
      title: "Disconnected " + service,
      description: "The service has been disconnected successfully.",
    });
  };
  
  const handleConfigure = (service: string) => {
    toast({
      title: "Configure " + service,
      description: "Opening configuration options...",
    });
  };
  
  const handleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    toast({
      title: `Auto Sync ${enabled ? 'Enabled' : 'Disabled'}`,
      description: `Files will ${enabled ? 'now' : 'no longer'} be automatically synchronized.`,
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>
          Connect cloud storage services for automatic file synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <IntegrationCard
            title="Dropbox"
            description="Cloud storage for photos and videos"
            status="connected"
            icon={<FolderIcon className="h-4 w-4" />}
            toggleOption={{
              label: "Auto Sync",
              enabled: autoSync,
              onChange: handleAutoSync
            }}
            onDisconnect={() => handleDisconnect('Dropbox')}
            onConfigure={() => handleConfigure('Dropbox')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
