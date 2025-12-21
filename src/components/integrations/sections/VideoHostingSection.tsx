
import React from 'react';
import { IntegrationCard } from '../IntegrationCard';
import { MonitorIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function VideoHostingSection() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Video Hosting</CardTitle>
        <CardDescription>
          Integrate video hosting platforms for property videos and tours
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <IntegrationCard
            title="Vimeo"
            description="Professional video hosting"
            status="coming_soon"
            icon={<MonitorIcon className="h-4 w-4" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}
