import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { ScanOrderForm } from '@/components/cubicasa/ScanOrderForm';
import { ScanOrderList } from '@/components/cubicasa/ScanOrderList';
import { ScanOrderDetail } from '@/components/cubicasa/ScanOrderDetail';
import { cubicasaService, CubiCasaOrder } from '@/services/cubicasaService';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';

const CubiCasaScanning = () => {
  const { role, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create');
  const [selectedOrder, setSelectedOrder] = useState<CubiCasaOrder | null>(null);
  const [orders, setOrders] = useState<CubiCasaOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has access
  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (role !== 'photographer' && role !== 'admin' && role !== 'superadmin') {
      toast({
        title: 'Access Denied',
        description: 'This page is only accessible to photographers and administrators.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [isAuthenticated, role, navigate, authLoading]);

  // Load orders on mount
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && (role === 'photographer' || role === 'admin' || role === 'superadmin')) {
      loadOrders();
    }
  }, [isAuthenticated, role, authLoading]);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await cubicasaService.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      // Extract more detailed error message
      let errorMessage = 'Failed to load scan orders';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = JSON.stringify(error.response.data);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderCreated = (order: CubiCasaOrder) => {
    setOrders([order, ...orders]);
    setSelectedOrder(order);
    setActiveTab('detail');
    toast({
      title: 'Scan Order Created',
      description: 'Your scan order has been created successfully.',
    });
  };

  const handleOrderSelected = (order: CubiCasaOrder) => {
    setSelectedOrder(order);
    setActiveTab('detail');
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
    setActiveTab('list');
    loadOrders();
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Show loading or access denied
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">Please log in to continue</p>
              <Button onClick={() => navigate('/')}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'photographer' && role !== 'admin' && role !== 'superadmin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card>
            <CardContent className="p-6 text-center">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription className="mt-2">
                  This page is only accessible to photographers and administrators.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => navigate('/dashboard')}
                className="w-full mt-4"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          badge="CubiCasa"
          title="CubiCasa Scanning"
          description="Create and manage floor plan scans"
        />

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">New Scan</TabsTrigger>
            <TabsTrigger value="list">My Scans</TabsTrigger>
            <TabsTrigger value="detail" disabled={!selectedOrder}>
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <ScanOrderForm
              onOrderCreated={handleOrderCreated}
              onCancel={() => setActiveTab('list')}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <ScanOrderList
              orders={orders}
              isLoading={isLoading}
              onOrderSelect={handleOrderSelected}
              onRefresh={loadOrders}
            />
          </TabsContent>

          <TabsContent value="detail" className="mt-6">
            {selectedOrder ? (
              <ScanOrderDetail
                order={selectedOrder}
                onBack={handleBackToList}
                onOrderUpdated={loadOrders}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No order selected
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CubiCasaScanning;
