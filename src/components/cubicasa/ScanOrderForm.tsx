import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cubicasaService, CreateOrderData, CubiCasaOrder } from '@/services/cubicasaService';
import { useShoots } from '@/context/ShootsContext';
import { Loader2 } from 'lucide-react';

interface ScanOrderFormProps {
  onOrderCreated: (order: CubiCasaOrder) => void;
  onCancel?: () => void;
}

export function ScanOrderForm({ onOrderCreated, onCancel }: ScanOrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateOrderData>({
    address: '',
    property_type: 'residential',
    shoot_id: undefined,
    notes: '',
    customer_name: '',
    customer_email: '',
  });
  const { shoots } = useShoots();

  // Filter shoots to show only relevant ones (scheduled or booked)
  const availableShoots = shoots.filter(
    (shoot) => shoot.status === 'scheduled' || shoot.status === 'booked'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.address.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Address is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await cubicasaService.createOrder({
        ...formData,
        shoot_id: formData.shoot_id || undefined,
      });
      
      onOrderCreated(order);
      
      // Reset form
      setFormData({
        address: '',
        property_type: 'residential',
        shoot_id: undefined,
        notes: '',
        customer_name: '',
        customer_email: '',
      });
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create scan order',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Scan Order</CardTitle>
        <CardDescription>
          Fill in the property details to create a new CubiCasa floor plan scan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Property Address *</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, State ZIP"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_type">Property Type</Label>
            <Select
              value={formData.property_type}
              onValueChange={(value) => setFormData({ ...formData, property_type: value })}
            >
              <SelectTrigger id="property_type">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="office">Office</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shoot_id">Link to Shoot (Optional)</Label>
            <Select
              value={formData.shoot_id?.toString() || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, shoot_id: value === 'none' ? undefined : parseInt(value) })
              }
            >
              <SelectTrigger id="shoot_id">
                <SelectValue placeholder="Select a shoot (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {availableShoots.map((shoot) => (
                  <SelectItem key={shoot.id} value={shoot.id.toString()}>
                    {shoot.location?.address || `Shoot #${shoot.id}`} - {shoot.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name (Optional)</Label>
            <Input
              id="customer_name"
              placeholder="John Doe"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_email">Customer Email (Optional)</Label>
            <Input
              id="customer_email"
              type="email"
              placeholder="john@example.com"
              value={formData.customer_email}
              onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this property..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Scan Order'
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
