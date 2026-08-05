import React, { useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { Loader2, Plus, Save, Edit, Trash2, MoreVertical } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { IconPicker, getIconComponent } from './IconPicker';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServiceGroups } from '@/hooks/useServiceGroups';
import API_ROUTES from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { ServiceCreateDialog } from './ServiceCreateDialog';
import type { PhotographerPayType, ServiceDraft, SqftRange } from './ServiceCreateDialog';

type Service = {
  id: string;
  name: string;
  description?: string;
  price: string;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  delivery_time?: string;
  photographer_required?: boolean;
  photographer_pay?: string | number;
  photographer_pay_type?: PhotographerPayType;
  photographer_pay_percent?: string | number | null;
  exclude_from_sales_commission?: boolean;
  photo_count?: number;
  quantity?: number;
  active: boolean;
  category?: string;
  icon?: string;
  sqft_ranges?: SqftRange[];
  service_group_ids?: string[];
  service_groups?: Array<{ id: string; name: string; description?: string | null }>;
};

const extractPhotoCount = (name: string) => {
  const match = name.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : 0;
};

interface ServiceCategory {
  id: string;
  name: string;
  icon?: string | null;
  is_default?: boolean;
}

const CATEGORY_ORDER = [
  'photo', 'video', 'drone', '3d', '360/3d tours', 'floor plans', 'floorplan',
  'virtual staging', 'commercials', 'packages', 'addons', 'unassigned',
];

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' ? value as UnknownRecord : {};

const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readResponseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);
  const message = asRecord(payload).message;
  return typeof message === 'string' && message ? message : fallback;
};

const normalizeSqftRange = (value: unknown): SqftRange | null => {
  const range = asRecord(value);
  const sqftFrom = toNumber(range.sqft_from);
  const sqftTo = toNumber(range.sqft_to);
  if (sqftFrom === undefined || sqftTo === undefined) return null;
  return {
    id: toNumber(range.id),
    sqft_from: sqftFrom,
    sqft_to: sqftTo,
    duration: toNumber(range.duration) ?? null,
    price: toNumber(range.price) ?? 0,
    photographer_pay: toNumber(range.photographer_pay) ?? null,
    photo_count: toNumber(range.photo_count) ?? null,
  };
};

const normalizeService = (value: unknown): Service | null => {
  const item = asRecord(value);
  if (item.id === null || item.id === undefined || typeof item.name !== 'string') return null;
  const category = asRecord(item.category);
  const categoryName = typeof category.name === 'string' ? category.name : '';
  const rangeValues = item.sqft_ranges ?? item.sqftRanges;
  const sqftRanges = Array.isArray(rangeValues)
    ? rangeValues.map(normalizeSqftRange).filter((range): range is SqftRange => range !== null)
    : [];
  const groupValues = Array.isArray(item.service_groups) ? item.service_groups : [];
  const serviceGroups = groupValues.flatMap((value) => {
    const group = asRecord(value);
    if (group.id === null || group.id === undefined || typeof group.name !== 'string') return [];
    return [{
      id: String(group.id),
      name: group.name,
      description: typeof group.description === 'string' ? group.description : '',
    }];
  });
  const photoCount = toNumber(item.photo_count)
    ?? (categoryName.toLowerCase().includes('photo') ? extractPhotoCount(item.name) : undefined);
  const payType = item.photographer_pay_type;
  const pay = item.photographer_pay;
  const rawGroupIds = Array.isArray(item.service_group_ids)
    ? item.service_group_ids
    : serviceGroups.map((group) => group.id);

  return {
    id: String(item.id),
    name: item.name,
    description: typeof item.description === 'string' ? item.description : '',
    price: String(item.price ?? '0'),
    pricing_type: item.pricing_type === 'variable' ? 'variable' : 'fixed',
    allow_multiple: Boolean(item.allow_multiple),
    delivery_time: item.delivery_time === null || item.delivery_time === undefined
      ? undefined
      : String(item.delivery_time),
    category: categoryName,
    photographer_required: Boolean(item.photographer_required),
    photographer_pay: typeof pay === 'string' || typeof pay === 'number' ? pay : undefined,
    photographer_pay_type: payType === 'percent' ? 'percent' : 'fixed',
    photographer_pay_percent: typeof item.photographer_pay_percent === 'string'
      || typeof item.photographer_pay_percent === 'number'
      ? item.photographer_pay_percent
      : null,
    exclude_from_sales_commission: Boolean(item.exclude_from_sales_commission),
    photo_count: photoCount,
    quantity: toNumber(item.quantity),
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    service_group_ids: rawGroupIds.map(String),
    service_groups: serviceGroups,
    sqft_ranges: sqftRanges,
    active: item.active === undefined ? true : Boolean(item.active),
  };
};

const normalizeServiceCategory = (value: unknown): ServiceCategory | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.id === null || record.id === undefined || typeof record.name !== 'string') return null;
  return {
    id: String(record.id),
    name: record.name,
    icon: typeof record.icon === 'string' ? record.icon : null,
    is_default: Boolean(record.is_default),
  };
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
  const [newService, setNewService] = useState<ServiceDraft>({
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
    photographer_pay_type: 'fixed',
    photographer_pay_percent: '',
    exclude_from_sales_commission: false,
    photo_count: undefined,
    quantity: undefined,
    service_group_ids: [],
  });
  const [newSqftRanges, setNewSqftRanges] = useState<SqftRange[]>([]);
  const isPercentPay = newService.photographer_pay_type === 'percent';
  const { toast } = useToast();
  const { data: categoryData, isLoading: categoriesLoading, refetch: refetchCategories } = useServiceCategories();
  const categories = React.useMemo(() => {
    const values: unknown = categoryData;
    return Array.isArray(values)
      ? values.map(normalizeServiceCategory).filter((category): category is ServiceCategory => category !== null)
      : [];
  }, [categoryData]);
  const { data: serviceGroups = [] } = useServiceGroups();
  const queryClient = useQueryClient();

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

  const serviceGroupOptions = React.useMemo(
    () =>
      serviceGroups.map((group) => ({
        id: group.id,
        label: group.name,
        description: group.description || undefined,
        meta: `${group.service_count} services • ${group.client_count} clients`,
      })),
    [serviceGroups],
  );

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

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
      photographer_pay_type: 'fixed',
      photographer_pay_percent: '',
      exclude_from_sales_commission: false,
      photo_count: undefined,
      quantity: undefined,
      service_group_ids: [],
    });
    setNewSqftRanges([]);
    setIsAddDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openAddService: handleOpenAddService,
    openAddCategory: () => setIsAddCategoryOpen(true),
  }));

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
      exclude_from_sales_commission: newService.exclude_from_sales_commission || false,
      photographer_pay: newService.photographer_required
        && !isPercentPay
        && newService.photographer_pay !== ''
        && newService.photographer_pay != null
        ? parseFloat(String(newService.photographer_pay))
        : null,
      photographer_pay_type: newService.photographer_required
        ? newService.photographer_pay_type
        : 'fixed',
      photographer_pay_percent: newService.photographer_required
        && isPercentPay
        && newService.photographer_pay_percent !== ''
        && newService.photographer_pay_percent != null
        ? parseFloat(String(newService.photographer_pay_percent))
        : null,
      photo_count: isNewServicePhotoCategory && newService.photo_count != null
        ? newService.photo_count
        : null,
      quantity: !isNewServicePhotoCategory && newService.quantity != null
        ? newService.quantity
        : null,
      service_group_ids: newService.service_group_ids.map((id) => Number(id)),
      sqft_ranges: newService.pricing_type === 'variable'
        ? newSqftRanges.map((range) => ({
            sqft_from: range.sqft_from,
            sqft_to: range.sqft_to,
            duration: range.duration,
            price: range.price,
            photographer_pay: newService.photographer_required ? range.photographer_pay : null,
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
        throw new Error(await readResponseErrorMessage(response, 'Failed to create service'));
      }

      toast({
        title: 'Service Added',
        description: 'Service created successfully.',
      });
      setIsAddDialogOpen(false);
      setNewSqftRanges([]);
      queryClient.invalidateQueries({ queryKey: ['service-groups'] });
      void fetchServices();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to create service.'),
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
        throw new Error(await readResponseErrorMessage(response, 'Failed to create category'));
      }

      toast({
        title: 'Category Created',
        description: `${name} added successfully.`,
      });
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryIcon('');
      await refetchCategories();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to create category.'),
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleEditCategory = (category: ServiceCategory) => {
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
        throw new Error(await readResponseErrorMessage(response, 'Failed to update category'));
      }

      toast({
        title: 'Category Updated',
        description: `${name} updated successfully.`,
      });
      setIsEditCategoryOpen(false);
      setEditingCategory(null);
      await refetchCategories();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update category.'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: ServiceCategory) => {
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
        throw new Error(await readResponseErrorMessage(response, 'Failed to delete category'));
      }

      toast({
        title: 'Category Deleted',
        description: `${category.name} removed successfully.`,
      });
      if (selectedCategory === String(category.id)) {
        setSelectedCategory(null);
      }
      await refetchCategories();
      void fetchServices();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to delete category.'),
        variant: 'destructive',
      });
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const headers = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      let response: Response | null = null;

      if (token) {
        response = await fetch(API_ROUTES.services.adminAll, { headers });
      }

      if (!response || !response.ok) {
        response = await fetch(API_ROUTES.services.all, { headers });
      }

      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const data: unknown = await response.json();
      const values = asRecord(data).data ?? data;
      const mappedServices = Array.isArray(values)
        ? values.map(normalizeService).filter((service): service is Service => service !== null)
        : [];

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
  }, [toast]);

  useEffect(() => {
    void fetchServices();
  }, [categories, fetchServices]);

  const selectedCategoryName = mergedCategories.find(cat => cat.id === selectedCategory)?.name;
  const normalizedSelectedCategory = selectedCategoryName
    ? normalizeCategoryName(selectedCategoryName)
    : null;

  const filteredServices = selectedCategory && normalizedSelectedCategory
    ? services.filter(service => normalizeCategoryName(service.category || '') === normalizedSelectedCategory)
    : services;
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
            availableServiceGroups={serviceGroups}
            onUpdate={fetchServices}
          />
        ))}
      </div>

      <ServiceCreateDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        newService={newService}
        setNewService={setNewService}
        newSqftRanges={newSqftRanges}
        setNewSqftRanges={setNewSqftRanges}
        isNewServicePhotoCategory={isNewServicePhotoCategory}
        serviceGroupOptions={serviceGroupOptions}
        onSave={handleSaveService}
      />

      {/* Add New Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] rounded-2xl sm:max-w-[420px] sm:rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
        <DialogContent className="w-[calc(100vw-1rem)] rounded-2xl sm:max-w-[420px] sm:rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
