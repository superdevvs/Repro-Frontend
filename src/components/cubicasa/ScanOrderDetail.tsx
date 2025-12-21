import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CubiCasaOrder, OrderStatus } from '@/services/cubicasaService';
import { format } from 'date-fns';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { PhotoUploader } from './PhotoUploader';
import { cubicasaService } from '@/services/cubicasaService';
import { useShoots } from '@/context/ShootsContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ScanOrderDetailProps {
  order: CubiCasaOrder;
  onBack: () => void;
  onOrderUpdated: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

export function ScanOrderDetail({
  order,
  onBack,
  onOrderUpdated,
}: ScanOrderDetailProps) {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedShootId, setSelectedShootId] = useState<number | undefined>(
    order.shoot_id
  );
  const { shoots } = useShoots();

  const availableShoots = shoots.filter(
    (shoot) => shoot.status === 'scheduled' || shoot.status === 'booked'
  );

  useEffect(() => {
    loadStatus();
    // Poll for status updates if order is processing
    if (order.status === 'processing' || order.status === 'pending') {
      const interval = setInterval(loadStatus, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [order.id, order.status]);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await cubicasaService.getOrderStatus(order.id);
      setOrderStatus(status);
    } catch (error: any) {
      console.error('Failed to load order status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleLinkToShoot = async () => {
    if (!selectedShootId) {
      toast({
        title: 'Error',
        description: 'Please select a shoot',
        variant: 'destructive',
      });
      return;
    }

    setIsLinking(true);
    try {
      await cubicasaService.linkToShoot(order.id, selectedShootId);
      toast({
        title: 'Success',
        description: 'Order linked to shoot successfully',
      });
      onOrderUpdated();
    } catch (error: any) {
      console.error('Failed to link order:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to link order to shoot',
        variant: 'destructive',
      });
    } finally {
      setIsLinking(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const floorPlanUrl = order.floor_plan_url || order.result_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">Scan Order Details</h2>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {order.address}
              </CardTitle>
              {order.property_type && (
                <p className="text-sm text-muted-foreground mt-1">
                  {order.property_type}
                </p>
              )}
            </div>
            {order.status && (
              <Badge
                variant="outline"
                className={`${
                  statusColors[order.status] || 'bg-gray-500'
                } text-white border-0`}
              >
                {order.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Order ID</p>
              <p className="font-medium">{order.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(order.created_at)}</p>
            </div>
            {order.updated_at && (
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDate(order.updated_at)}</p>
              </div>
            )}
          </div>

          {order.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {orderStatus && (
            <Alert>
              {orderStatus.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : orderStatus.status === 'failed' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <AlertDescription>
                <div className="flex justify-between items-center">
                  <span>
                    Status: {orderStatus.status}
                    {orderStatus.progress !== undefined && (
                      <span className="ml-2">({orderStatus.progress}%)</span>
                    )}
                  </span>
                  {isLoadingStatus && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </div>
                {orderStatus.message && (
                  <p className="text-xs mt-1">{orderStatus.message}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {floorPlanUrl && (
            <div>
              <p className="text-sm font-medium mb-2">Floor Plan</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(floorPlanUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Floor Plan
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Link to Shoot</p>
            <div className="flex gap-2">
              <Select
                value={selectedShootId?.toString() || 'none'}
                onValueChange={(value) =>
                  setSelectedShootId(value === 'none' ? undefined : parseInt(value))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a shoot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableShoots.map((shoot) => (
                    <SelectItem key={shoot.id} value={shoot.id.toString()}>
                      {shoot.location?.address || `Shoot #${shoot.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleLinkToShoot}
                disabled={isLinking || !selectedShootId || selectedShootId === order.shoot_id}
              >
                {isLinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            {order.shoot_id && (
              <p className="text-xs text-muted-foreground mt-2">
                Currently linked to Shoot #{order.shoot_id}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUploader
            orderId={order.id}
            onUploadComplete={() => {
              toast({
                title: 'Photos Uploaded',
                description: 'Photos have been uploaded successfully',
              });
              loadStatus();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
