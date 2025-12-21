
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { CouponsList } from '@/components/coupons/CouponsList';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CreateCouponDialog } from '@/components/coupons/CreateCouponDialog';

const Coupons = () => {
  const { role } = useAuth();
  const canCreateCoupons = ['admin', 'superadmin'].includes(role);
  
  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Admin Settings"
            title="Coupons & Discounts"
            description="Manage promotional codes and discounts"
            action={
              canCreateCoupons ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Coupon
                    </Button>
                  </DialogTrigger>
                  <CreateCouponDialog />
                </Dialog>
              ) : undefined
            }
          />
          <CouponsList />
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Coupons;
