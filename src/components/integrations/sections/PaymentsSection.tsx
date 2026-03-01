
import React, { useState, useEffect } from 'react';
import { IntegrationCard } from '../IntegrationCard';
import { BanknoteIcon, CreditCard } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config/env';
import axios from 'axios';

export function PaymentsSection() {
  const [squareEnabled, setSquareEnabled] = useState(false);
  const [squareLoading, setSquareLoading] = useState(true);

  // Load Square enabled state from settings API on mount
  useEffect(() => {
    const fetchSquareEnabled = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/admin/settings/square_enabled`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.data?.success && response.data?.data) {
          setSquareEnabled(!!response.data.data.value);
        }
      } catch {
        // Setting not found = default false
        setSquareEnabled(false);
      } finally {
        setSquareLoading(false);
      }
    };
    fetchSquareEnabled();
  }, []);

  const handleSquareToggle = async (enabled: boolean) => {
    const previous = squareEnabled;
    setSquareEnabled(enabled);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/admin/settings`,
        {
          key: 'square_enabled',
          value: enabled,
          type: 'boolean',
          description: 'Enable or disable Square payment processing',
        },
        {
          headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
        }
      );
      toast({
        title: `Square ${enabled ? 'Enabled' : 'Disabled'}`,
        description: `Square payment processing has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch {
      setSquareEnabled(previous);
      toast({
        title: 'Error',
        description: 'Failed to update Square setting. Please try again.',
        variant: 'destructive',
      });
    }
  };

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
            title="Stripe"
            description="Online payments & checkout"
            status="connected"
            icon={<CreditCard className="h-4 w-4" />}
            onConfigure={() => handleConfigure('Stripe')}
          />
          <IntegrationCard
            title="Square"
            description="In-person and admin payments"
            status={squareEnabled ? 'connected' : 'not_connected'}
            icon={<BanknoteIcon className="h-4 w-4" />}
            toggleOption={{
              label: "Enabled",
              enabled: squareEnabled,
              onChange: handleSquareToggle,
            }}
            onDisconnect={() => handleDisconnect('Square')}
            onConfigure={() => handleConfigure('Square')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
