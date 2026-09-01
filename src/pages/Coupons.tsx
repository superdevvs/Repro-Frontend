
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CouponsList } from '@/components/coupons/CouponsList';
import { usePermission } from '@/hooks/usePermission';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateCouponDialog } from '@/components/coupons/CreateCouponDialog';

const Coupons = () => {
  const [createCouponOpen, setCreateCouponOpen] = React.useState(false);
  const permission = usePermission();
  const couponsPermission = permission.forResource('coupons');
  const canViewCoupons = couponsPermission.canView();
  const canCreateCoupons = couponsPermission.canCreate();

  if (!canViewCoupons) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Admin Settings"
          title="Discounts"
          description="Manage discount codes and discounts"
          action={
            canCreateCoupons ? (
              <>
                <Button onClick={() => setCreateCouponOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Discount
                </Button>
                <CreateCouponDialog open={createCouponOpen} onOpenChange={setCreateCouponOpen} />
              </>
            ) : undefined
          }
        />
        <CouponsList />
      </div>
    </DashboardLayout>
  );
};

export default Coupons;
