import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { ShootData } from '@/types/shoots';
import { Plus } from 'lucide-react';

interface Service {
  id: number;
  name: string;
  price: number;
  category_id?: number;
}

interface AddServiceDialogProps {
  shoot: ShootData;
  onShootUpdate: () => void;
}

export function AddServiceDialog({ shoot, onShootUpdate }: AddServiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [photographerPay, setPhotographerPay] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchServices();
    }
  }, [open]);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/services`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch services');
      const data = await res.json();
      setServices(data.data || data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: 'Error',
        description: 'Failed to load services',
        variant: 'destructive',
      });
    }
  };

  const handleAddService = async () => {
    if (!selectedServiceId) {
      toast({
        title: 'Error',
        description: 'Please select a service',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const selectedService = services.find(s => s.id === Number(selectedServiceId));
      
      // Get current shoot services
      const currentServices = Array.isArray(shoot.services) 
        ? shoot.services.map((s: any) => ({
            id: typeof s === 'object' ? s.id : s,
            price: typeof s === 'object' ? s.price : selectedService?.price || 0,
            quantity: 1,
          }))
        : [];

      // Add new service
      const newService = {
        id: Number(selectedServiceId),
        price: customPrice ? parseFloat(customPrice) : (selectedService?.price || 0),
        quantity: 1,
        photographer_pay: photographerPay ? parseFloat(photographerPay) : null,
      };

      const updatedServices = [...currentServices, newService];

      // Calculate new base quote from all services
      const newBaseQuote = updatedServices.reduce((sum, s) => {
        const price = typeof s.price === 'number' ? s.price : parseFloat(s.price) || 0;
        const qty = s.quantity || 1;
        return sum + (price * qty);
      }, 0);

      // Calculate tax (use existing tax rate from shoot or default to 0)
      const currentTaxRate = shoot.payment?.taxRate || 0;
      const newTaxAmount = newBaseQuote * (currentTaxRate / 100);
      const newTotalQuote = newBaseQuote + newTaxAmount;

      // Update shoot with new services and recalculated quote
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          services: updatedServices,
          base_quote: parseFloat(newBaseQuote.toFixed(2)),
          tax_amount: parseFloat(newTaxAmount.toFixed(2)),
          total_quote: parseFloat(newTotalQuote.toFixed(2)),
        }),
      });

      if (!res.ok) throw new Error('Failed to add service');

      toast({
        title: 'Success',
        description: 'Service added successfully',
      });
      
      setOpen(false);
      setSelectedServiceId('');
      setCustomPrice('');
      setPhotographerPay('');
      onShootUpdate();
    } catch (error: any) {
      console.error('Error adding service:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add service',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter out services already attached to shoot
  const currentServiceIds = Array.isArray(shoot.services)
    ? shoot.services.map((s: any) => (typeof s === 'object' ? s.id : s))
    : [];
  const availableServices = services.filter(s => !currentServiceIds.includes(s.id));

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Service
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service to Shoot</DialogTitle>
            <DialogDescription>
              Select a service to add to this shoot
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service">Service</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.length === 0 ? (
                    <SelectItem value="no-services" disabled>No services available</SelectItem>
                  ) : (
                    availableServices.map((service) => {
                      const price = typeof service.price === 'number' ? service.price : (typeof service.price === 'string' ? parseFloat(service.price) : 0);
                      const priceDisplay = isNaN(price) ? '0.00' : price.toFixed(2);
                      return (
                        <SelectItem key={service.id} value={String(service.id)}>
                          {service.name} - ${priceDisplay}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Custom Price (Optional)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="Leave empty to use service default price"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photographerPay">Photographer's Pay (Optional)</Label>
              <Input
                id="photographerPay"
                type="number"
                step="0.01"
                placeholder="Amount photographer will charge for this service"
                value={photographerPay}
                onChange={(e) => setPhotographerPay(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddService} disabled={loading || !selectedServiceId}>
              {loading ? 'Adding...' : 'Add Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
