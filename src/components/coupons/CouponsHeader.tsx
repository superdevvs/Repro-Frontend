
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CreateCouponDialog } from './CreateCouponDialog';
import { useAuth } from '@/components/auth/AuthProvider';

export function CouponsHeader() {
  const { role } = useAuth();
  const canCreateCoupons = ['admin', 'superadmin', 'editing_manager'].includes(role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
            Admin Settings
          </Badge>
          <h1 className="text-3xl font-bold">Coupons & Discounts</h1>
          <p className="text-muted-foreground">
            Manage promotional codes and discounts
          </p>
        </div>

        {canCreateCoupons && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <CreateCouponDialog />
          </Dialog>
        )}
      </div>
    </div>
  );
}
