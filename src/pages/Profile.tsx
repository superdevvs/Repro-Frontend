
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientProfile } from '@/components/profile/ClientProfile';
import { EditorProfile } from '@/components/profile/EditorProfile';
import { AdminProfile } from '@/components/profile/AdminProfile';
import { toast } from '@/components/ui/use-toast';
import { ProfileActivityCard } from '@/components/profile/ProfileActivityCard';
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard';

const Profile = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

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

  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get('tab') === 'equipments' || searchParams.get('verify') === 'equipment') {
    const search = location.search || '?tab=equipments&verify=equipment';
    return <Navigate to={`/photographer-account${search}`} replace />;
  }

  if (user?.role === 'photographer') {
    const search = location.search || '';
    return <Navigate to={`/photographer-account${search}`} replace />;
  }

  // Determine which profile component to render based on user role
  const renderProfileByRole = () => {
    switch (user?.role) {
      case 'client':
        return <ClientProfile />;
      case 'editor':
        return <EditorProfile />;
      case 'admin':
      case 'superadmin':
      case 'editing_manager':
      case 'salesRep':
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
      <div className="space-y-6 px-2 pt-3 pb-3 sm:p-6">
        {renderProfileByRole()}
        {(user?.role === 'client' || user?.role === 'editor') && (
          <section aria-label="Account security and activity" className="grid gap-6 lg:grid-cols-2">
            <ProfileActivityCard />
            <ProfileSecurityCard />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
