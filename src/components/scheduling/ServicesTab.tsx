import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

export function ServicesTab() {
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
  // const { data: categories, isLoading: categoriesLoading } = useServiceCategories();
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useServiceCategories();

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  
  // Edit category state
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  useEffect(() => {
    fetchServices();

    // Set default selected category when categories are loaded
    if (categories && categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.services.all);
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const data = await response.json();
      
      // Helper to extract photo count from service name (e.g., "25 Photos" -> 25)
      const extractPhotoCount = (name: string): number | undefined => {
        const match = name.match(/(\d+)\s*photo/i);
        return match ? parseInt(match[1], 10) : undefined;
      };
      
      const mappedServices: Service[] = data.data.map((item) => {
        const categoryName = item.category?.name || '';
        const isPhotoCategory = categoryName.toLowerCase().includes('photo');
        
        // Use photo_count from backend if available, otherwise extract from name for Photo category
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
          sqft_ranges: item.sqft_ranges || [],
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


  // const handleCategoryChange = (categoryId: string) => {
  //   console.log('Selected category:', categoryId);
  //   setSelectedCategory(categoryId);
  // };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewService(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // SQFT Range helpers for Add Service
  const addNewSqftRange = () => {
    const lastRange = newSqftRanges[newSqftRanges.length - 1];
    const newFrom = lastRange ? lastRange.sqft_to + 1 : 1;
    setNewSqftRanges([
      ...newSqftRanges,
      { sqft_from: newFrom, sqft_to: newFrom + 1499, duration: 60, price: 0, photographer_pay: null }
    ]);
  };

  const updateNewSqftRange = (index: number, field: keyof SqftRange, value: number | null) => {
    const updated = [...newSqftRanges];
    updated[index] = { ...updated[index], [field]: value };
    setNewSqftRanges(updated);
  };

  const removeNewSqftRange = (index: number) => {
    setNewSqftRanges(newSqftRanges.filter((_, i) => i !== index));
  };

  // Open Add Service dialog with current category pre-selected
  const handleOpenAddService = () => {
    // Pre-select the currently selected category tab
    if (selectedCategory) {
      setNewService(prev => ({ ...prev, category: selectedCategory }));
    }
    setIsAddDialogOpen(true);
  };

  // Check if selected category is Photo
  const isNewServicePhotoCategory = React.useMemo(() => {
    const cat = categories?.find(c => c.id === newService.category);
    return (cat?.name || '').toLowerCase().includes('photo');
  }, [categories, newService.category]);

  const handleSaveService = async () => {
    try {
      const selectedCategoryData = categories?.find(cat => cat.id == newService.category);
      if (!selectedCategoryData) {
        toast({
          title: 'Error',
          description: 'Please select a category',
          variant: 'destructive',
        });
        return;
      }

      const token = localStorage.getItem('authToken');

      if (!token) {
        throw new Error("No auth token found in localStorage");
      }

      const response = await fetch(API_ROUTES.services.create, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newService.name,
          description: newService.description,
          price: parseFloat(newService.price) || 0,
          pricing_type: newService.pricing_type || 'fixed',
          allow_multiple: newService.allow_multiple || false,
          delivery_time: parseInt(newService.delivery_time) || 24,
          category_id: newService.category,
          icon: newService.icon,
          photographer_required: newService.photographer_required || false,
          photographer_pay: newService.photographer_pay ? parseFloat(newService.photographer_pay) : null,
          photo_count: newService.photo_count || null,
          quantity: newService.quantity || null,
          sqft_ranges: newService.pricing_type === 'variable' ? newSqftRanges.map(range => ({
            sqft_from: range.sqft_from,
            sqft_to: range.sqft_to,
            duration: range.duration,
            price: range.price,
            photographer_pay: range.photographer_pay,
          })) : [],
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save service');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: result.message || 'Service saved successfully',
      });

      setIsAddDialogOpen(false);
      setNewService({
        name: '',
        description: '',
        price: '',
        pricing_type: 'fixed',
        allow_multiple: false,
        delivery_time: '',
        category: '',
        icon: '',
        photographer_required: false,
        photographer_pay: '',
        photo_count: undefined,
        quantity: undefined,
      });
      setNewSqftRanges([]);
      fetchServices(); // Make sure fetchServices is also updated to use your custom API
    } catch (error) {
      console.error('Error saving service:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save service',
        variant: 'destructive',
      });
    }
  };


  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }

    try {
      setIsCreatingCategory(true);

      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No auth token found');

      const res = await fetch(API_ROUTES.categories.create, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: newCategoryName.trim(),
          icon: newCategoryIcon 
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to create category');
      }

      const data = await res.json(); // assume returns { data: { id, name, ... }, message? }

      // refetch list so new category appears
      await refetchCategories?.();

      // Select the newly created category if id available
      const newId = data?.data?.id;
      if (newId) setSelectedCategory(newId);

      toast({ title: 'Category created', description: data.message || 'New category has been added.' });
      setNewCategoryName('');
      setNewCategoryIcon('');
      setIsAddCategoryOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not create category.', variant: 'destructive' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryIcon(category.icon || '');
    setIsEditCategoryOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!editCategoryName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }

    if (!editingCategory) return;

    try {
      setIsUpdatingCategory(true);
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No auth token found');

      const res = await fetch(API_ROUTES.categories.update(editingCategory.id), {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: editCategoryName.trim(),
          icon: editCategoryIcon 
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to update category');
      }

      const data = await res.json();
      await refetchCategories?.();
      
      // If the edited category was selected, keep it selected
      if (selectedCategory === editingCategory.id) {
        setSelectedCategory(editingCategory.id);
      }

      toast({ title: 'Category updated', description: data.message || 'Category has been updated.' });
      setIsEditCategoryOpen(false);
      setEditingCategory(null);
      setEditCategoryName('');
      setEditCategoryIcon('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not update category.', variant: 'destructive' });
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: any) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? All services in this category will be moved to "Unassigned" category.`)) {
      return;
    }

    try {
      setIsDeletingCategory(true);
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No auth token found');

      const res = await fetch(API_ROUTES.categories.delete(category.id), {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to delete category');
      }

      const data = await res.json();
      await refetchCategories?.();
      
      // If the deleted category was selected, select the first available category
      if (selectedCategory === category.id) {
        const remainingCategories = categories?.filter(c => c.id !== category.id);
        if (remainingCategories && remainingCategories.length > 0) {
          setSelectedCategory(remainingCategories[0].id);
        } else {
          setSelectedCategory(null);
        }
      }

      // Refetch services to update their categories
      await fetchServices();

      const servicesMoved = data.services_moved || 0;
      toast({ 
        title: 'Category deleted', 
        description: servicesMoved > 0 
          ? `${servicesMoved} service(s) moved to "Unassigned" category.`
          : 'Category has been deleted.' 
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not delete category.', variant: 'destructive' });
    } finally {
      setIsDeletingCategory(false);
    }
  };



  const filteredServices = selectedCategory
    ? services.filter(service => service.category === categories?.find(cat => cat.id === selectedCategory)?.name)
    : services;

  // Sort categories in specific order: Photo, Video, Drone, 3D, Floor Plans, Virtual Staging, etc.
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
    if (!categories) return [];
    
    return [...categories].sort((a, b) => {
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
  }, [categories]);

  return (
  <div className="space-y-6">
    {/* Add Service Button - positioned top right above tabs */}
    <div className="flex justify-end -mt-14">
      <Button onClick={handleOpenAddService}>
        <Plus className="h-4 w-4 mr-2" />
        Add Service
      </Button>
    </div>

    <div className="space-y-4">
      {categoriesLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {sortedCategories.map(category => {
            const Icon = category.icon ? getIconComponent(category.icon) : null;
            return (
              <div key={category.id} className="relative group">
                <Button
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => handleCategoryChange(category.id)}
                  className="rounded-full transition-all gap-2 pr-8"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {category.name}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="rounded-full border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary gap-2"
            onClick={() => setIsAddCategoryOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
        <DialogFooter>
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
      <DialogContent className="sm:max-w-[420px]">
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
      <DialogContent className="sm:max-w-[420px]">
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
}