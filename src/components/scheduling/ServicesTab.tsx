import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Save, Edit, Trash2, MoreVertical, HelpCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ServiceCard } from './ServiceCard';
import { CategorySelect } from '@/components/settings/CategorySelect';
import { IconPicker, getIconComponent } from './IconPicker';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import API_ROUTES from '@/lib/api';

type SqftRange = {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  duration: number | null;
  price: number;
  photographer_pay: number | null;
  photo_count?: number | null;
};

type Service = {
  id: string;
  name: string;
  description?: string;
  price: string;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  delivery_time?: string;
  photographer_required?: boolean;
  photo_count?: number;
  quantity?: number;
  active: boolean;
  category?: string;
  icon?: string;
  sqft_ranges?: SqftRange[];
};

const extractPhotoCount = (name: string) => {
  const match = name.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : 0;
};

export interface ServicesTabHandle {
  openAddService: () => void;
  openAddCategory: () => void;
}

export const ServicesTab = forwardRef<ServicesTabHandle>(function ServicesTab(_props, ref) {
  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    pricing_type: 'fixed' as 'fixed' | 'variable',
    allow_multiple: false,
    delivery_time: '',
    category: '',
    icon: '',
    photographer_required: false,
    photographer_pay: '',
    photo_count: undefined as number | undefined,
    quantity: undefined as number | undefined,
  });
  const [newSqftRanges, setNewSqftRanges] = useState<SqftRange[]>([]);
  const { toast } = useToast();
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useServiceCategories();

  const normalizeCategoryName = (name?: string) => {
    const normalized = (name || '').trim().toLowerCase();
    if (normalized === 'photo' || normalized === 'photos') return 'photos';
    return normalized;
  };

  const mergedCategories = React.useMemo(() => {
    if (!categories) return [];
    const byKey = new Map<string, (typeof categories)[number]>();
    categories.forEach((category) => {
      const key = normalizeCategoryName(category.name);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, category);
        return;
      }
      if (key === 'photos') {
        const existingName = (existing.name || '').toLowerCase();
        const nextName = (category.name || '').toLowerCase();
        if (existingName === 'photo' && nextName === 'photos') {
          byKey.set(key, category);
        }
      }
    });
    return Array.from(byKey.values());
  }, [categories]);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  useEffect(() => {
    fetchServices();
  }, [categories]);

  useEffect(() => {
    if (!mergedCategories.length) return;
    const hasSelection = selectedCategory && mergedCategories.some(cat => cat.id === selectedCategory);
    if (!hasSelection) {
      const photoCategory = mergedCategories.find(cat => normalizeCategoryName(cat.name) === 'photos');
      setSelectedCategory(photoCategory?.id ?? mergedCategories[0].id);
    }
  }, [mergedCategories, selectedCategory]);

  const getCategoryNameById = (categoryId?: string) => {
    if (!categoryId) return '';
    const category = mergedCategories.find(cat => String(cat.id) === String(categoryId))
      ?? categories?.find(cat => String(cat.id) === String(categoryId));
    return category?.name || '';
  };

  const isNewServicePhotoCategory =
    normalizeCategoryName(getCategoryNameById(newService.category)) === 'photos';

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleOpenAddService = () => {
    const defaultCategoryId = selectedCategory ?? mergedCategories[0]?.id ?? '';
    setNewService({
      name: '',
      description: '',
      price: '',
      pricing_type: 'fixed',
      allow_multiple: false,
      delivery_time: '',
      category: defaultCategoryId ? String(defaultCategoryId) : '',
      icon: '',
      photographer_required: false,
      photographer_pay: '',
      photo_count: undefined,
      quantity: undefined,
    });
    setNewSqftRanges([]);
    setIsAddDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openAddService: handleOpenAddService,
    openAddCategory: () => setIsAddCategoryOpen(true),
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setNewService(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addNewSqftRange = () => {
    const lastRange = newSqftRanges[newSqftRanges.length - 1];
    const newFrom = lastRange ? lastRange.sqft_to + 1 : 1;
    setNewSqftRanges([
      ...newSqftRanges,
      {
        sqft_from: newFrom,
        sqft_to: newFrom + 1499,
        duration: 60,
        price: 0,
        photographer_pay: null,
        photo_count: null,
      },
    ]);
  };

  const updateNewSqftRange = (index: number, field: keyof SqftRange, value: number | null) => {
    setNewSqftRanges(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeNewSqftRange = (index: number) => {
    setNewSqftRanges(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveService = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({
        title: 'Auth Error',
        description: 'Please login as an admin to add services.',
        variant: 'destructive',
      });
      return;
    }

    if (!newService.name?.trim() || !newService.category) {
      toast({
        title: 'Missing details',
        description: 'Please provide a service name and category.',
        variant: 'destructive',
      });
      return;
    }

    const parsedPrice = parseFloat(newService.price);
    const parsedDeliveryTime = parseInt(newService.delivery_time, 10);

    const payload = {
      name: newService.name.trim(),
      description: newService.description?.trim() || undefined,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      pricing_type: newService.pricing_type || 'fixed',
      allow_multiple: newService.allow_multiple || false,
      delivery_time: Number.isFinite(parsedDeliveryTime) ? parsedDeliveryTime : 0,
      category_id: Number(newService.category),
      icon: newService.icon || null,
      photographer_required: newService.photographer_required || false,
      photographer_pay: newService.photographer_pay
        ? parseFloat(String(newService.photographer_pay))
        : null,
      photo_count: isNewServicePhotoCategory && newService.photo_count != null
        ? newService.photo_count
        : null,
      quantity: !isNewServicePhotoCategory && newService.quantity != null
        ? newService.quantity
        : null,
      sqft_ranges: newService.pricing_type === 'variable'
        ? newSqftRanges.map((range) => ({
            sqft_from: range.sqft_from,
            sqft_to: range.sqft_to,
            duration: range.duration,
            price: range.price,
            photographer_pay: range.photographer_pay,
            photo_count: range.photo_count ?? null,
          }))
        : [],
    };

    try {
      const response = await fetch(API_ROUTES.services.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create service');
      }

      toast({
        title: 'Service Added',
        description: 'Service created successfully.',
      });
      setIsAddDialogOpen(false);
      setNewSqftRanges([]);
      fetchServices();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create service.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast({
        title: 'Category name required',
        description: 'Please enter a category name.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCategory(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(API_ROUTES.categories.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, icon: newCategoryIcon || null }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create category');
      }

      toast({
        title: 'Category Created',
        description: `${name} added successfully.`,
      });
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryIcon('');
      await refetchCategories();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create category.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setEditCategoryName(category?.name || '');
    setEditCategoryIcon(category?.icon || '');
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory?.id) return;
    const name = editCategoryName.trim();
    if (!name) {
      toast({
        title: 'Category name required',
        description: 'Please enter a category name.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingCategory(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(API_ROUTES.categories.update(editingCategory.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, icon: editCategoryIcon || null }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update category');
      }

      toast({
        title: 'Category Updated',
        description: `${name} updated successfully.`,
      });
      setIsEditCategoryOpen(false);
      setEditingCategory(null);
      await refetchCategories();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update category.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: any) => {
    if (!category?.id) return;
    const shouldDelete = window.confirm(`Delete category "${category.name}"? This cannot be undone.`);
    if (!shouldDelete) return;

    setIsDeletingCategory(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(API_ROUTES.categories.delete(category.id), {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete category');
      }

      toast({
        title: 'Category Deleted',
        description: `${category.name} removed successfully.`,
      });
      if (selectedCategory === String(category.id)) {
        setSelectedCategory(null);
      }
      await refetchCategories();
      fetchServices();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete category.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.services.all);
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const data = await response.json();

      const mappedServices: Service[] = data.data.map((item) => {
        const categoryName = item.category?.name || '';
        const isPhotoCategory = categoryName.toLowerCase().includes('photo');

        let photoCount = item.photo_count;
        if (photoCount == null && isPhotoCategory) {
          photoCount = extractPhotoCount(item.name);
        }

        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: item.price,
          pricing_type: item.pricing_type || 'fixed',
          allow_multiple: item.allow_multiple ?? false,
          delivery_time: item.delivery_time,
          category: categoryName,
          photographer_required: item.photographer_required ?? false,
          photo_count: photoCount,
          quantity: item.quantity,
          icon: item.icon,
          sqft_ranges: item.sqft_ranges || item.sqftRanges || [],
          active: true,
        };
      });

      setServices(mappedServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: 'Error',
        description: 'Failed to load services',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategoryName = mergedCategories.find(cat => cat.id === selectedCategory)?.name;
  const normalizedSelectedCategory = selectedCategoryName
    ? normalizeCategoryName(selectedCategoryName)
    : null;

  const filteredServices = selectedCategory && normalizedSelectedCategory
    ? services.filter(service => normalizeCategoryName(service.category || '') === normalizedSelectedCategory)
    : services;

  const CATEGORY_ORDER = [
    'photo',
    'video',
    'drone',
    '3d',
    '360/3d tours',
    'floor plans',
    'floorplan',
    'virtual staging',
    'commercials',
    'packages',
    'addons',
    'unassigned',
  ];

  const sortedCategories = React.useMemo(() => {
    if (!mergedCategories.length) return [];

    return [...mergedCategories].sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();

      const aIndex = CATEGORY_ORDER.findIndex(cat => aName.includes(cat) || cat.includes(aName));
      const bIndex = CATEGORY_ORDER.findIndex(cat => bName.includes(cat) || cat.includes(bName));

      
      // If both found in order, sort by order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // If only a is found, a comes first
      if (aIndex !== -1) return -1;
      // If only b is found, b comes first
      if (bIndex !== -1) return 1;
      // Otherwise sort alphabetically
      return aName.localeCompare(bName);
    });
  }, [mergedCategories]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        {categoriesLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex min-w-max items-center gap-2">
              {sortedCategories.map(category => {
                const Icon = category.icon ? getIconComponent(category.icon) : null;
                const displayName = normalizeCategoryName(category.name) === 'photos'
                  ? 'Photos'
                  : category.name;
                return (
                  <div key={category.id} className="relative group">
                    <Button
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      onClick={() => handleCategoryChange(category.id)}
                      className="rounded-full transition-all gap-2 pr-8"
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {displayName}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditCategory(category);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!category.is_default && !['photo', 'video'].includes(category.name?.toLowerCase()) && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(category);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

              <Button
                variant="outline"
                className="hidden sm:inline-flex rounded-full border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary gap-2"
                onClick={() => setIsAddCategoryOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onUpdate={fetchServices}
          />
        ))}
      </div>

      {/* Add New Service Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                <div className="grid grid-cols-[0.8fr_0.8fr_0.6fr_0.6fr_0.8fr_auto] gap-2 text-xs font-medium text-muted-foreground">
                  <div>From</div>
                  <div>To</div>
                  <div>Count</div>
                  <div>Dur (min)</div>
                  <div>Price ($)</div>
                  <div className="w-8"></div>
                </div>

                {/* Range rows */}
                {newSqftRanges.map((range, index) => (
                  <div key={index} className="grid grid-cols-[0.8fr_0.8fr_0.6fr_0.6fr_0.8fr_auto] gap-2 items-center">
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
                <Label htmlFor="photographer_pay">Photographer's Pay ($)</Label>
                <Input
                  id="photographer_pay"
                  name="photographer_pay"
                  type="number"
                  step="0.01"
                  value={newService.photographer_pay}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-3 sm:pt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveService}>
              <Save className="w-4 h-4 mr-2" />
              Save Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] rounded-2xl sm:max-w-[420px] sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="new-category-name">Category name</Label>
            <Input
              id="new-category-name"
              placeholder="e.g., Floor Plans"
              value={newCategoryName}
              autoFocus
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
              }}
            />
            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <IconPicker
                value={newCategoryIcon}
                onChange={setNewCategoryIcon}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={isCreatingCategory}>
              {isCreatingCategory ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] rounded-2xl sm:max-w-[420px] sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="edit-category-name">Category name</Label>
            <Input
              id="edit-category-name"
              placeholder="e.g., Floor Plans"
              value={editCategoryName}
              autoFocus
              onChange={(e) => setEditCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateCategory();
              }}
            />
            
            <div className="space-y-2">
              <Label>Icon (optional)</Label>
              <IconPicker
                value={editCategoryIcon}
                onChange={setEditCategoryIcon}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditCategoryOpen(false);
              setEditingCategory(null);
              setEditCategoryName('');
              setEditCategoryIcon('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCategory} disabled={isUpdatingCategory}>
              {isUpdatingCategory ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
});