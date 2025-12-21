
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, CheckCircle2, XCircle, Plus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { IconPicker, getIconComponent } from './IconPicker';

type SqftRange = {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
  photo_count?: number | null;
};

type ServiceProps = {
  service: {
    id: string;
    name: string;
    description?: string;
    price: string;
    pricing_type?: 'fixed' | 'variable';
    allow_multiple?: boolean;
    delivery_time?: string;
    photographer_required?: boolean;
    photographer_pay?: string | number;
    photo_count?: number;
    quantity?: number;
    active: boolean;
    category?: string;
    icon?: string;
    sqft_ranges?: SqftRange[];
  };
  onUpdate: () => void;
};

export function ServiceCard({ service, onUpdate }: ServiceProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  type Service = ServiceProps['service'];
  const [editedService, setEditedService] = useState<Service>({ ...service });
  const [sqftRanges, setSqftRanges] = useState<SqftRange[]>(service.sqft_ranges || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const isPhotoCategory = (service.category || '').toLowerCase() === 'photo';

  // Sync sqftRanges when service changes or dialog opens
  useEffect(() => {
    if (isEditDialogOpen) {
      setEditedService({ ...service });
      setSqftRanges(service.sqft_ranges || []);
    }
  }, [isEditDialogOpen, service]);

  const addSqftRange = () => {
    const lastRange = sqftRanges[sqftRanges.length - 1];
    const newFrom = lastRange ? lastRange.sqft_to + 1 : 1;
    setSqftRanges([
      ...sqftRanges,
      { sqft_from: newFrom, sqft_to: newFrom + 1499, duration: 60, price: 0, photographer_pay: null }
    ]);
  };

  const updateSqftRange = (index: number, field: keyof SqftRange, value: number | null) => {
    const updated = [...sqftRanges];
    updated[index] = { ...updated[index], [field]: value };
    setSqftRanges(updated);
  };

  const removeSqftRange = (index: number) => {
    setSqftRanges(sqftRanges.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setEditedService({
      ...editedService,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSwitchChange = (checked: boolean) => {
    setEditedService({
      ...editedService,
      active: checked,
    });
  };

  const handleSaveService = async () => {
    setIsSubmitting(true);
  
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found in localStorage');
      toast({
        title: 'Auth Error',
        description: 'You are not logged in as admin. Please login first.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
  
    const payload = {
      name: editedService.name?.trim(),
      description: editedService.description?.trim(),
      price: parseFloat(editedService.price),
      pricing_type: editedService.pricing_type || 'fixed',
      allow_multiple: editedService.allow_multiple || false,
      delivery_time: parseInt(editedService.delivery_time),
      icon: editedService.icon,
      photographer_required: editedService.photographer_required || false,
      photographer_pay: editedService.photographer_pay ? parseFloat(String(editedService.photographer_pay)) : null,
      photo_count: (isPhotoCategory && editedService.photo_count != null)
        ? editedService.photo_count
        : null,
      quantity: (!isPhotoCategory && editedService.quantity != null)
        ? editedService.quantity
        : null,
      sqft_ranges: editedService.pricing_type === 'variable' ? sqftRanges.map(range => ({
        id: range.id,
        sqft_from: range.sqft_from,
        sqft_to: range.sqft_to,
        duration: range.duration,
        price: range.price,
        photographer_pay: range.photographer_pay,
      })) : [],
    };
  
    console.log('Payload being sent:', payload);
    console.log('Payload type check:', {
      name: typeof payload.name,
      description: typeof payload.description,
      price: typeof payload.price,
      delivery_time: typeof payload.delivery_time,
    });
    console.log('Token:', token);
  
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/admin/services/${service.id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );
  
      toast({
        title: 'Service Updated',
        description: res.data.message || 'Service updated successfully.',
      });
  
      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating service:', error);
  
      const errData = error.response?.data;
      const validationErrors = errData?.errors;
      const errMsg = errData?.message || 'Failed to update service.';
  
      if (validationErrors) {
        console.error('Validation errors:', validationErrors);
      }
  
      toast({
        title: 'Update Failed',
        description: validationErrors
          ? Object.values(validationErrors).flat().join(' ')
          : errMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const handleDeleteService = async () => {
    setIsSubmitting(true);
  
    try {
      const token = localStorage.getItem('authToken');
  
      if (!token) {
        throw new Error("No auth token found in localStorage");
      }
  
      const response = await axios.delete(
        `${API_BASE_URL}/api/admin/services/${service.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );
  
      toast({
        title: 'Service Deleted',
        description: response.data?.message || 'Service deleted successfully.',
      });
  
      setIsDeleteDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete service.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(service.price));

  const IconComponent = getIconComponent(service.icon || 'Camera');

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                <IconComponent className="h-4 w-4" />
              </div>
              {/* Show quantity: photo_count for photos, quantity for others */}
              {(isPhotoCategory ? service.photo_count : service.quantity) != null && (
                <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {isPhotoCategory ? service.photo_count : service.quantity}
                </span>
              )}
              <CardTitle className="text-lg">{service.name}</CardTitle>
            </div>
            {/* <Badge variant={service.active ? "default" : "secondary"}>
              {service.active ? "Active" : "Inactive"}
            </Badge> */}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-muted-foreground text-sm mb-4">
            {service.description || "No description provided"}
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Price:</span>
              <span className="font-semibold">{formattedPrice}</span>
            </div>
            
            {service.delivery_time !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Delivery Time:</span>
                <span>{service.delivery_time} hours</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-sm font-medium">Photographer Required:</span>
              <span>
                {service.photographer_required ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </span>
            </div>
            
            {isPhotoCategory && service.photo_count != null && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Photo Count:</span>
                <span>{service.photo_count} photos</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-3">
          <div className="flex justify-between w-full">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('Edit button clicked');
                setIsEditDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                name="name"
                value={editedService.name}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                value={editedService.description || ''}
                onChange={handleInputChange}
              />
            </div>

            {/* Icon and Quantity side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker
                  value={editedService.icon || ''}
                  onChange={(value) => setEditedService({ ...editedService, icon: value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_field">
                  {isPhotoCategory ? 'Photo Count' : 'Quantity'}
                </Label>
                <Input
                  id="quantity_field"
                  type="number"
                  min="0"
                  value={isPhotoCategory 
                    ? (editedService.photo_count ?? '') 
                    : (editedService.quantity ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = val === '' ? undefined : parseInt(val, 10);
                    if (isPhotoCategory) {
                      setEditedService({ ...editedService, photo_count: numVal });
                    } else {
                      setEditedService({ ...editedService, quantity: numVal });
                    }
                  }}
                  placeholder={isPhotoCategory ? "Number of photos" : "Quantity"}
                />
              </div>
            </div>

            {/* Pricing Type */}
            <div className="space-y-2">
              <Label>Pricing</Label>
              <Select
                value={editedService.pricing_type || 'fixed'}
                onValueChange={(value: 'fixed' | 'variable') => 
                  setEditedService({ ...editedService, pricing_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pricing type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="variable">Variable (SQFT)</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {/* Fixed pricing fields */}
            {editedService.pricing_type !== 'variable' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    value={editedService.price}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Delivery Time (hours)</Label>
                  <Input
                    id="delivery_time"
                    name="delivery_time"
                    type="number"
                    value={editedService.delivery_time}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}

            {/* Variable pricing - SQFT Ranges */}
            {editedService.pricing_type === 'variable' && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Define each square footage range and provide the duration and price for each range.
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Price will be automatically calculated based on the property's square footage when booking a shoot.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-[0.8fr_0.8fr_0.6fr_0.6fr_0.8fr_auto] gap-2 text-xs font-medium text-muted-foreground">
                  <div>From</div>
                  <div>To</div>
                  <div>Count</div>
                  <div>Dur (min)</div>
                  <div>Price ($)</div>
                  <div className="w-8"></div>
                </div>

                {/* Range rows */}
                {sqftRanges.map((range, index) => (
                  <div key={index} className="grid grid-cols-[0.8fr_0.8fr_0.6fr_0.6fr_0.8fr_auto] gap-2 items-center">
                    <Input
                      type="number"
                      min="0"
                      value={range.sqft_from}
                      onChange={(e) => updateSqftRange(index, 'sqft_from', parseInt(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={range.sqft_to}
                      onChange={(e) => updateSqftRange(index, 'sqft_to', parseInt(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={range.photo_count ?? ''}
                      onChange={(e) => updateSqftRange(index, 'photo_count', e.target.value ? parseInt(e.target.value) : null)}
                      className="h-8 text-sm"
                      placeholder={isPhotoCategory ? "25" : "1"}
                    />
                    <Input
                      type="number"
                      min="0"
                      value={range.duration || ''}
                      onChange={(e) => updateSqftRange(index, 'duration', e.target.value ? parseInt(e.target.value) : null)}
                      className="h-8 text-sm"
                      placeholder="60"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={range.price}
                        onChange={(e) => updateSqftRange(index, 'price', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm pl-5"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeSqftRange(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Add new range button */}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-primary p-0 h-auto"
                  onClick={addSqftRange}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add New Range
                </Button>

                {/* Default/fallback price */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-xs">Default Price (fallback)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      value={editedService.price}
                      onChange={handleInputChange}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_time" className="text-xs">Default Duration (hours)</Label>
                    <Input
                      id="delivery_time"
                      name="delivery_time"
                      type="number"
                      value={editedService.delivery_time}
                      onChange={handleInputChange}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Label htmlFor="photographer_required" className="cursor-pointer">
                Photographer Required
              </Label>
              <Switch
                id="photographer_required"
                name="photographer_required"
                checked={editedService.photographer_required || false}
                onCheckedChange={(checked) => 
                  setEditedService({...editedService, photographer_required: checked})
                }
              />
            </div>
            {editedService.photographer_required && (
              <div className="space-y-2">
                <Label htmlFor="photographer_pay">Photographer's Pay ($)</Label>
                <Input
                  id="photographer_pay"
                  name="photographer_pay"
                  type="number"
                  step="0.01"
                  value={editedService.photographer_pay || ''}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
            )}
            
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveService}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete the service "{service.name}"? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteService}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
