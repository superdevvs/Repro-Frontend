
import React, { useState } from 'react';
import { IntegrationCard } from '../IntegrationCard';
import { BanknoteIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PaymentsSection() {
  const [squareEnabled, setSquareEnabled] = useState(true);
  const [splitPayments, setSplitPayments] = useState(true);
  
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
  
  const handleSplitPayments = (enabled: boolean) => {
    setSplitPayments(enabled);
    toast({
      title: `Split Payments ${enabled ? 'Enabled' : 'Disabled'}`,
      description: `Photographers will ${enabled ? 'now' : 'no longer'} receive their share automatically.`,
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>
          Manage payment processing integrations for transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <IntegrationCard
            title="Square"
            description="In-person and online payments"
            status="connected"
            icon={<BanknoteIcon className="h-4 w-4" />}
            toggleOption={{
              label: "Split Payments",
              enabled: splitPayments,
              onChange: handleSplitPayments
            }}
            onDisconnect={() => handleDisconnect('Square')}
            onConfigure={() => handleConfigure('Square')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
