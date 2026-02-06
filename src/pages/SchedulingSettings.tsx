
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { ServicesTab } from '@/components/scheduling/ServicesTab';

const SchedulingSettings = () => {
  const { role } = useAuth();

  // Only allow admin and superadmin to access this page
  if (!['admin', 'superadmin'].includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Settings"
          title="Services"
          description="Manage services, pricing, and details"
        />

        <ServicesTab />
      </div>
    </DashboardLayout>
  );
};

export default SchedulingSettings;
