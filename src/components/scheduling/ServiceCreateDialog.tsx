import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectChecklist } from '@/components/ui/multi-select-checklist';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CategorySelect } from '@/components/settings/CategorySelect';
import { IconPicker } from './IconPicker';
import { cn } from '@/lib/utils';
import { HelpCircle, Plus, Save, Trash2 } from 'lucide-react';

export type PhotographerPayType = 'fixed' | 'percent';

export interface SqftRange {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
  photo_count?: number | null;
}

export interface ServiceDraft {
  name: string;
  description: string;
  price: string;
  pricing_type: 'fixed' | 'variable';
  allow_multiple: boolean;
  delivery_time: string;
  category: string;
  icon: string;
  photographer_required: boolean;
  photographer_pay: string;
  photographer_pay_type: PhotographerPayType;
  photographer_pay_percent: string;
  exclude_from_sales_commission: boolean;
  photo_count?: number;
  quantity?: number;
  service_group_ids: string[];
}

interface ServiceGroupOption {
  id: string;
  label: string;
  description?: string;
  meta?: string;
}

interface ServiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newService: ServiceDraft;
  setNewService: Dispatch<SetStateAction<ServiceDraft>>;
  newSqftRanges: SqftRange[];
  setNewSqftRanges: Dispatch<SetStateAction<SqftRange[]>>;
  isNewServicePhotoCategory: boolean;
  serviceGroupOptions: ServiceGroupOption[];
  onSave: () => void;
}

export function ServiceCreateDialog({
  open,
  onOpenChange,
  newService,
  setNewService,
  newSqftRanges,
  setNewSqftRanges,
  isNewServicePhotoCategory,
  serviceGroupOptions,
  onSave,
}: ServiceCreateDialogProps) {
  const isPercentPay = newService.photographer_pay_type === 'percent';
  const percent = parseFloat(newService.photographer_pay_percent);
  const price = parseFloat(newService.price);
  const percentPayPreview = isPercentPay && Number.isFinite(percent)
    && Number.isFinite(price) && price > 0
    ? `${percent}% of $${price.toFixed(2)} = $${((price * percent) / 100).toFixed(2)}`
    : '';
  const addRangeGridClass = newService.photographer_required
    ? 'grid-cols-[0.8fr_0.8fr_0.7fr_0.8fr_0.9fr_1fr_auto]'
    : 'grid-cols-[0.8fr_0.8fr_0.7fr_0.8fr_0.9fr_auto]';

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setNewService((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addNewSqftRange = () => {
    setNewSqftRanges((current) => {
      const lastRange = current[current.length - 1];
      const sqftFrom = lastRange ? lastRange.sqft_to + 1 : 1;
      return [...current, {
        sqft_from: sqftFrom,
        sqft_to: sqftFrom + 1499,
        duration: 60,
        price: 0,
        photographer_pay: null,
        photo_count: null,
      }];
    });
  };

  const updateNewSqftRange = (
    index: number,
    field: keyof SqftRange,
    value: number | null,
  ) => {
    setNewSqftRanges((current) => current.map((range, rangeIndex) =>
      rangeIndex === index ? { ...range, [field]: value } : range));
  };

  const removeNewSqftRange = (index: number) => {
    setNewSqftRanges((current) => current.filter((_, rangeIndex) => rangeIndex !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[88vh] overflow-hidden rounded-2xl sm:max-w-[600px] sm:max-h-[90vh] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(88vh-10.5rem)] space-y-4 overflow-y-auto py-4 pr-1 sm:max-h-[calc(90vh-10.5rem)]">
          <div className="space-y-2">
            <CategorySelect
              value={newService.category}
              onChange={(value) => {
                setNewService(prev => ({ ...prev, category: value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              name="name"
              value={newService.name}
              onChange={handleInputChange}
              placeholder="e.g., HDR Photos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              value={newService.description}
              onChange={handleInputChange}
              placeholder="Service description"
            />
          </div>
          <div className="space-y-2">
            <Label>Service Groups</Label>
            <MultiSelectChecklist
              options={serviceGroupOptions}
              value={newService.service_group_ids}
              onChange={(value) => setNewService((prev) => ({ ...prev, service_group_ids: value }))}
              placeholder="Visible to all clients unless you assign one or more service groups."
              emptyMessage="Create a service group to start restricting visibility."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={newService.icon}
                onChange={(value) => setNewService(prev => ({ ...prev, icon: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_field">
                {isNewServicePhotoCategory ? 'Photo Count' : 'Quantity'}
              </Label>
              <Input
                id="quantity_field"
                type="number"
                min="0"
                value={isNewServicePhotoCategory 
                  ? (newService.photo_count ?? '') 
                  : (newService.quantity ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = val === '' ? undefined : parseInt(val, 10);
                  if (isNewServicePhotoCategory) {
                    setNewService(prev => ({ ...prev, photo_count: numVal }));
                  } else {
                    setNewService(prev => ({ ...prev, quantity: numVal }));
                  }
                }}
                placeholder={isNewServicePhotoCategory ? "Number of photos" : "Quantity"}
              />
            </div>
          </div>
    
          {/* Pricing Type */}
          <div className="space-y-2">
            <Label>Pricing</Label>
            <Select
              value={newService.pricing_type}
              onValueChange={(value: 'fixed' | 'variable') => 
                setNewService(prev => ({ ...prev, pricing_type: value }))
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
          {newService.pricing_type !== 'variable' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={newService.price}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_time">Delivery Time (hours)</Label>
                <Input
                  id="delivery_time"
                  name="delivery_time"
                  type="number"
                  value={newService.delivery_time}
                  onChange={handleInputChange}
                  placeholder="24"
                />
              </div>
            </div>
          )}
    
          {/* Variable pricing - SQFT Ranges */}
          {newService.pricing_type === 'variable' && (
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
              <div className={`grid ${addRangeGridClass} gap-2 text-xs font-medium text-muted-foreground`}>
                <div>From</div>
                <div>To</div>
                <div>Count</div>
                <div>Dur (min)</div>
                <div>Price ($)</div>
                {newService.photographer_required && <div>Photographer Pay ($)</div>}
                <div className="w-8"></div>
              </div>
    
              {/* Range rows */}
              {newSqftRanges.map((range, index) => (
                <div key={index} className={`grid ${addRangeGridClass} gap-2 items-center`}>
                  <Input
                    type="number"
                    min="0"
                    value={range.sqft_from}
                    onChange={(e) => updateNewSqftRange(index, 'sqft_from', parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={range.sqft_to}
                    onChange={(e) => updateNewSqftRange(index, 'sqft_to', parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={range.photo_count ?? ''}
                    onChange={(e) => updateNewSqftRange(index, 'photo_count', e.target.value ? parseInt(e.target.value) : null)}
                    className="h-8 text-sm"
                    placeholder={isNewServicePhotoCategory ? "25" : "1"}
                  />
                  <Input
                    type="number"
                    min="0"
                    value={range.duration || ''}
                    onChange={(e) => updateNewSqftRange(index, 'duration', e.target.value ? parseInt(e.target.value) : null)}
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
                      onChange={(e) => updateNewSqftRange(index, 'price', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm pl-5"
                    />
                  </div>
                  {newService.photographer_required && (
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={range.photographer_pay ?? ''}
                        onChange={(e) =>
                          updateNewSqftRange(
                            index,
                            'photographer_pay',
                            e.target.value === '' ? null : parseFloat(e.target.value),
                          )
                        }
                        className="h-8 text-sm pl-5"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeNewSqftRange(index)}
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
                onClick={addNewSqftRange}
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
                    value={newService.price}
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
                    value={newService.delivery_time}
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
              checked={newService.photographer_required}
              onCheckedChange={(checked) => 
                setNewService(prev => ({ ...prev, photographer_required: checked }))
              }
            />
          </div>
          {newService.photographer_required && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="photographer_pay">
                  {isPercentPay ? "Photographer's Pay (%)" : "Photographer's Pay ($)"}
                </Label>
                {/* Flat amount or a percentage of this service's price — admins
                    pick per service, so both models can coexist. */}
                <div className="flex overflow-hidden rounded-md border border-border">
                  <button
                    type="button"
                    aria-pressed={!isPercentPay}
                    className={cn(
                      'px-2 py-1 text-xs font-medium transition-colors',
                      !isPercentPay
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted',
                    )}
                    onClick={() =>
                      setNewService((prev) => ({ ...prev, photographer_pay_type: 'fixed' }))
                    }
                  >
                    $
                  </button>
                  <button
                    type="button"
                    aria-pressed={isPercentPay}
                    className={cn(
                      'px-2 py-1 text-xs font-medium transition-colors',
                      isPercentPay
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted',
                    )}
                    onClick={() =>
                      setNewService((prev) => ({ ...prev, photographer_pay_type: 'percent' }))
                    }
                  >
                    %
                  </button>
                </div>
              </div>
              {isPercentPay ? (
                <>
                  <Input
                    id="photographer_pay"
                    name="photographer_pay_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newService.photographer_pay_percent ?? ''}
                    onChange={handleInputChange}
                    placeholder="45.00"
                  />
                  {percentPayPreview && (
                    <p className="text-xs text-muted-foreground">{percentPayPreview}</p>
                  )}
                </>
              ) : (
                <Input
                  id="photographer_pay"
                  name="photographer_pay"
                  type="number"
                  step="0.01"
                  value={newService.photographer_pay}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="exclude_from_sales_commission" className="cursor-pointer">
                Exclude from sales commission
              </Label>
              <p className="text-xs text-muted-foreground">
                Use for travel, cancellation, and reschedule fees.
              </p>
            </div>
            <Switch
              id="exclude_from_sales_commission"
              checked={newService.exclude_from_sales_commission}
              onCheckedChange={(checked) =>
                setNewService(prev => ({ ...prev, exclude_from_sales_commission: checked }))
              }
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-3 sm:pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

