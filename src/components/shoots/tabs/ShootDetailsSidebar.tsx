import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Phone,
  Building,
  Camera,
  DollarSign,
  CheckCircle,
  Circle,
  ChevronRight,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';

interface ShootDetailsSidebarProps {
  shoot: ShootData;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  onProcessPayment: () => void;
  onMarkPaid: () => void;
}

export function ShootDetailsSidebar({
  shoot,
  isSuperAdmin,
  isAdmin,
  onProcessPayment,
  onMarkPaid,
}: ShootDetailsSidebarProps) {
  const { toast } = useToast();
  const client = shoot.client;
  const photographer = shoot.photographer;
  const payment = shoot.payment || {
    baseQuote: 0,
    taxAmount: 0,
    totalQuote: 0,
    totalPaid: 0,
  };

  const remainingBalance = payment.totalQuote - payment.totalPaid;
  const isPaid = remainingBalance <= 0.01;

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="w-80 border-l bg-muted/20 p-6 space-y-4 overflow-y-auto h-full">
      {/* Client Info Card */}
      <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20">
                {client?.name ? (
                  <span className="text-sm font-bold text-primary">
                    {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{client?.name || 'Unknown'}</p>
                {client?.company && (
                  <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                )}
              </div>
            </div>
            
            {client?.email && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-9"
                onClick={() => handleEmail(client.email!)}
              >
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="truncate">{client.email}</span>
              </Button>
            )}
            
            {client?.phone && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-9"
                onClick={() => handleCall(client.phone!)}
              >
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{client.phone}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photographer Card */}
      {photographer && (
        <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Camera className="h-4 w-4 text-blue-600" />
              </div>
              Photographer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border-2 border-blue-500/20">
                <Camera className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{photographer.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
              </div>
            </div>
            
            {isAdmin && photographer.id && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  toast({ title: 'Change Photographer', description: 'Photographer assignment dialog would open here' });
                }}
              >
                Change Photographer
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing Summary Card */}
      {(isAdmin || isSuperAdmin) && (
        <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              Billing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base</span>
                <span className="font-medium">${payment.baseQuote?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">${payment.taxAmount?.toFixed(2) || '0.00'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-foreground">${payment.totalQuote?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 font-semibold">
                <span>Paid</span>
                <span>${payment.totalPaid?.toFixed(2) || '0.00'}</span>
              </div>
              <div className={`flex items-center justify-between font-semibold ${
                remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                <span>Outstanding</span>
                <span>${remainingBalance.toFixed(2)}</span>
              </div>
            </div>
            
            {isSuperAdmin && (
              <>
                <Separator className="my-3" />
                {!isPaid ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={onMarkPaid}
                  >
                    <CheckCircle className="h-3 w-3 mr-1.5" />
                    Mark as Paid
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paid</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


