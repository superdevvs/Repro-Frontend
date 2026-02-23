
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientProfile } from '@/components/profile/ClientProfile';
import { PhotographerProfile } from '@/components/profile/PhotographerProfile';
import { EditorProfile } from '@/components/profile/EditorProfile';
import { AdminProfile } from '@/components/profile/AdminProfile';
import { toast } from '@/components/ui/use-toast';

const Profile = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Log for debugging
    console.log('User role in Profile page:', user?.role);
  }, [user]);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="px-2 pt-3 pb-3 sm:p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    toast({
      title: "Authentication Required",
      description: "Please log in to view your profile.",
      variant: "destructive",
    });
    return <Navigate to="/" replace />;
  }

  // Determine which profile component to render based on user role
  const renderProfileByRole = () => {
    switch (user?.role) {
      case 'client':
        return <ClientProfile />;
      case 'photographer':
        return <PhotographerProfile />;
      case 'editor':
        return <EditorProfile />;
      case 'admin':
      case 'superadmin':
        return <AdminProfile />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <h1 className="text-2xl font-bold">Invalid Role</h1>
            <p className="text-muted-foreground mt-2">
              You don't have permission to access this page.
            </p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="px-2 pt-3 pb-3 sm:p-6">
        {renderProfileByRole()}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
