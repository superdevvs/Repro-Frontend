import React from 'react';
import {
  Aperture,
  Camera,
  Check,
  Cuboid as Cube,
  Layers,
  Palette,
  PenTool,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { formatPrice, getServicePricingForSqft } from '@/utils/servicePricing';
import type { ServiceWithPricing, SqftRange } from '@/utils/servicePricing';

export type ServiceSelectionOption = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | string | null;
  category?: { id?: string | number; name?: string | null } | string | null;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: unknown[];
  delivery_time?: unknown;
  photographer_pay?: unknown;
};

type CategoryDisplay = {
  id: string;
  name: string;
  count: number;
  icon: LucideIcon;
};

type ServiceSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceSelectionOption[];
  selectedServices: ServiceSelectionOption[];
  onSelectedServicesChange: (services: ServiceSelectionOption[]) => void;
  servicesLoading?: boolean;
  effectiveSqft?: number | null;
  title?: string;
  description?: string;
};

const FALLBACK_CATEGORY_NAME = 'More services';

const PRIMARY_CATEGORY_ORDER: Record<string, number> = {
  photos: 1,
  video: 2,
  drone: 3,
  '360': 4,
  '3d': 4,
  floor: 5,
  plan: 5,
  virtual: 6,
  staging: 6,
};

const PRIMARY_CATEGORY_ICONS: Array<{ keyword: string; icon: LucideIcon }> = [
  { keyword: 'photo', icon: Camera },
  { keyword: 'video', icon: Video },
  { keyword: 'drone', icon: Aperture },
  { keyword: '360', icon: Cube },
  { keyword: '3d', icon: Cube },
  { keyword: 'floor', icon: Layers },
  { keyword: 'plan', icon: Layers },
  { keyword: 'virtual', icon: Sparkles },
  { keyword: 'staging', icon: Sparkles },
];

const FALLBACK_ICONS: LucideIcon[] = [Camera, Video, Aperture, Cube, Layers, Sparkles, Palette, PenTool];

const normalizeCategoryName = (name?: string | null) => {
  const normalized = (name || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

const getCategoryRawName = (service?: ServiceSelectionOption | null) => {
  if (!service?.category) return undefined;
  return typeof service.category === 'string' ? service.category : service.category.name || undefined;
};

const getCategoryRawId = (service?: ServiceSelectionOption | null) => {
  if (!service?.category || typeof service.category === 'string') return undefined;
  return service.category.id;
};

const getServiceCategoryId = (service?: ServiceSelectionOption | null) => {
  const normalizedName = normalizeCategoryName(getCategoryRawName(service));
  if (normalizedName === 'photos') return 'photos';
  const categoryId = getCategoryRawId(service);
  if (categoryId) return String(categoryId);
  return normalizedName || 'uncategorized';
};

const getServiceCategoryName = (service?: ServiceSelectionOption | null) => {
  const normalizedName = normalizeCategoryName(getCategoryRawName(service));
  if (normalizedName === 'photos') return 'Photos';
  return getCategoryRawName(service) ?? FALLBACK_CATEGORY_NAME;
};

const getCategoryIcon = (name: string, index: number): LucideIcon => {
  const normalized = name?.toLowerCase?.() ?? '';
  const match = PRIMARY_CATEGORY_ICONS.find(({ keyword }) => normalized.includes(keyword));
  if (match) return match.icon;
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
};

const getServiceSqftRanges = (service?: ServiceSelectionOption | ServiceWithPricing | null) =>
  (service?.sqft_ranges || (service as any)?.sqftRanges || []) as SqftRange[];

export function ServiceSelectionDialog({
  open,
  onOpenChange,
  services,
  selectedServices,
  onSelectedServicesChange,
  servicesLoading = false,
  effectiveSqft,
  title = 'Select services',
  description = 'Pick the services for this shoot, compare prices quickly, then tap Done.',
}: ServiceSelectionDialogProps) {
  const isMobile = useIsMobile();
  const [serviceSearchQuery, setServiceSearchQuery] = React.useState('');
  const [panelCategory, setPanelCategory] = React.useState<string>('all');

  const categoryOptions = React.useMemo<CategoryDisplay[]>(() => {
    if (!services?.length) return [];
    const categories = new Map<string, CategoryDisplay>();

    services.forEach((service) => {
      const id = getServiceCategoryId(service);
      const name = getServiceCategoryName(service);
      const existing = categories.get(id);
      if (existing) {
        existing.count += 1;
        return;
      }
      categories.set(id, {
        id,
        name,
        count: 1,
        icon: getCategoryIcon(name, categories.size),
      });
    });

    return Array.from(categories.values()).sort((first, second) => {
      const firstKey = Object.keys(PRIMARY_CATEGORY_ORDER).find((key) => first.name.toLowerCase().includes(key));
      const secondKey = Object.keys(PRIMARY_CATEGORY_ORDER).find((key) => second.name.toLowerCase().includes(key));
      const firstScore = firstKey ? PRIMARY_CATEGORY_ORDER[firstKey] : Number.MAX_SAFE_INTEGER;
      const secondScore = secondKey ? PRIMARY_CATEGORY_ORDER[secondKey] : Number.MAX_SAFE_INTEGER;
      if (firstScore === secondScore) return first.name.localeCompare(second.name);
      return firstScore - secondScore;
    });
  }, [services]);

  React.useEffect(() => {
    if (categoryOptions.length === 0) return;
    const exists = categoryOptions.some((category) => category.id === panelCategory);
    if (!exists) {
      setPanelCategory(categoryOptions[0].id);
    }
  }, [categoryOptions, panelCategory]);

  React.useEffect(() => {
    if (!open) {
      setServiceSearchQuery('');
    }
  }, [open]);

  const panelServices = React.useMemo(() => {
    if (!services?.length) return [];
    let filtered = panelCategory
      ? services.filter((service) => getServiceCategoryId(service) === panelCategory)
      : services;

    const query = serviceSearchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((service) =>
        service.name.toLowerCase().includes(query) ||
        String(service.description || '').toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [panelCategory, services, serviceSearchQuery]);

  const selectedServicesTotal = React.useMemo(
    () =>
      selectedServices.reduce((total, service) => {
        const numericPrice = Number(service.price ?? 0);
        return total + (Number.isFinite(numericPrice) ? numericPrice : 0);
      }, 0),
    [selectedServices],
  );

  const selectedCountByCategory = React.useMemo(() => {
    const counts = new Map<string, number>();

    selectedServices.forEach((service) => {
      const categoryId = getServiceCategoryId(service);
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });

    return counts;
  }, [selectedServices]);

  const isServiceSelected = (serviceId: string) =>
    selectedServices.some((service) => String(service.id) === String(serviceId));

  const toggleServiceSelection = (service: ServiceSelectionOption) => {
    const serviceId = String(service.id);
    const exists = isServiceSelected(serviceId);

    if (exists) {
      onSelectedServicesChange(selectedServices.filter((selected) => String(selected.id) !== serviceId));
      return;
    }

    let adjustedService = { ...service, id: serviceId };
    const sqftRanges = getServiceSqftRanges(service);
    if (service.pricing_type === 'variable' && effectiveSqft && sqftRanges.length) {
      const pricingInfo = getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges } as ServiceWithPricing, effectiveSqft);
      adjustedService = { ...adjustedService, price: pricingInfo.price };
    }

    onSelectedServicesChange([...selectedServices, adjustedService]);

    if (isMobile && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  };

  const body = (mobileDrawer = false) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden sm:h-[70vh] sm:flex-row">
      <aside className="shrink-0 border-b border-border/60 bg-background/95 px-2.5 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:max-h-[70vh] sm:w-64 sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4">
        <div className="-mx-1.5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:flex-col sm:gap-2 sm:overflow-visible sm:pb-0 sm:snap-none [&::-webkit-scrollbar]:hidden">
          {categoryOptions.map((category) => {
            const isActive = category.id === panelCategory;
            const selectedCount = selectedCountByCategory.get(category.id) || 0;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setPanelCategory(category.id)}
                className={cn(
                  'flex min-h-9 flex-shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-full sm:gap-3 sm:rounded-lg sm:px-4 sm:py-2.5',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] sm:border-primary/60 sm:bg-primary/10 sm:text-primary sm:shadow-none'
                    : 'border-border/60 bg-background/80 text-foreground/85 hover:border-primary/40 hover:bg-primary/5 sm:border-transparent sm:bg-transparent sm:text-muted-foreground sm:hover:bg-muted/40',
                  category.id === 'all' ? 'min-w-[112px]' : 'min-w-[98px]',
                )}
              >
                <div className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted sm:flex sm:h-9 sm:w-9">
                  <category.icon className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:block">
                  <p className="truncate text-xs font-medium leading-tight sm:text-sm">{category.name}</p>
                  <p className="hidden text-[11px] text-muted-foreground sm:block sm:text-xs">{category.count} items</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {selectedCount > 0 && (
                    <span
                      className={cn(
                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none tabular-nums',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground sm:bg-primary sm:text-primary-foreground'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      {selectedCount}
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold leading-none tabular-nums sm:hidden',
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {category.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div
        className={cn(
          'min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 sm:space-y-4 sm:p-6',
          mobileDrawer ? 'pb-4' : 'pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:pb-6',
        )}
      >
        <div className="sticky top-0 z-20 -mx-2.5 border-b border-border/50 bg-background/95 px-2.5 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:static sm:mx-0 sm:border-0 sm:px-0 sm:py-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search services..."
              value={serviceSearchQuery}
              onChange={(event) => setServiceSearchQuery(event.target.value)}
              className="h-9 border-border/70 pl-8 text-sm focus-visible:ring-primary/40"
            />
          </div>
        </div>

        {servicesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : panelServices.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
            {panelServices.map((service) => {
              const serviceId = String(service.id);
              const isSelected = isServiceSelected(serviceId);
              const sqftRanges = getServiceSqftRanges(service);
              const supportsVariablePricing = !!(
                effectiveSqft &&
                service.pricing_type === 'variable' &&
                sqftRanges.length
              );
              const pricingInfo = supportsVariablePricing
                ? getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges } as ServiceWithPricing, effectiveSqft)
                : null;
              const displayPrice = pricingInfo
                ? formatPrice(pricingInfo.price)
                : formatPrice(Number(service.price ?? 0));
              const matchedRange = pricingInfo?.matchedRange;
              const sqftContext = matchedRange
                ? `${matchedRange.sqft_from.toLocaleString()} - ${matchedRange.sqft_to.toLocaleString()} sqft tier`
                : supportsVariablePricing
                ? `Using default price for ${effectiveSqft?.toLocaleString()} sqft`
                : null;
              const categoryName = getServiceCategoryName(service);

              return (
                <div
                  key={serviceId}
                  className={cn(
                    'group relative cursor-pointer overflow-hidden rounded-lg border border-l-4 p-2.5 transition-all duration-200 sm:rounded-2xl sm:p-3',
                    isSelected
                      ? 'border-primary/55 border-l-primary bg-primary/[0.08] shadow-[0_6px_18px_-12px_rgba(59,130,246,0.65)]'
                      : 'border-border/70 border-l-border/80 bg-background hover:border-primary/35 hover:border-l-primary/40',
                  )}
                  onClick={() => toggleServiceSelection(service)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[15px] font-semibold leading-tight sm:text-base">{service.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                        {service.description}
                      </p>
                      {sqftContext && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
                          {sqftContext}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-base font-semibold leading-none tabular-nums text-foreground sm:text-lg">
                        {displayPrice}
                      </span>
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors sm:hidden',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <Checkbox
                        className="hidden sm:inline-flex"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleServiceSelection(service)}
                      />
                    </div>
                  </div>
                  {categoryName && (
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {categoryName}
                        {supportsVariablePricing && matchedRange && (
                          <span className="ml-1 text-[8px] tracking-normal text-primary">SQFT</span>
                        )}
                      </Badge>
                      {isSelected && (
                        <span className="text-[11px] font-medium text-primary sm:hidden">Selected</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-left text-sm text-muted-foreground">
            {serviceSearchQuery.trim()
              ? 'No services match this search in the selected category.'
              : 'No services exist in this category yet. Pick a different category to continue.'}
          </div>
        )}
      </div>
    </div>
  );

  const footer = (mobileDrawer = false) => (
    <>
      <div className={cn('min-w-0', !mobileDrawer && 'sm:hidden')}>
        <p className="text-sm font-semibold leading-tight">
          {selectedServices.length} Selected · {formatPrice(selectedServicesTotal)}
        </p>
      </div>
      {!mobileDrawer && (
        <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
          {selectedServices.length} selected · {formatPrice(selectedServicesTotal)}
        </p>
      )}
      <Button
        className="h-10 px-5"
        disabled={selectedServices.length === 0}
        onClick={() => onOpenChange(false)}
      >
        Done
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[84vh] max-h-[84vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden">{body(true)}</div>
          <DrawerFooter className="border-t border-border/80 bg-background/95 backdrop-blur [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] supports-[backdrop-filter]:bg-background/85">
            {footer(true)}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:!max-h-[90vh] sm:!w-[96vw] sm:!max-w-5xl [&>button]:right-2 [&>button]:top-2">
        <DialogHeader className="items-start space-y-1 border-b border-border/80 px-6 py-4 text-left">
          <DialogTitle className="w-full pr-10 text-left leading-tight">{title}</DialogTitle>
          <DialogDescription className="w-full pr-10 text-left text-sm leading-snug">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body(false)}
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/80 bg-background/95 px-6 py-4 backdrop-blur [padding-bottom:1rem] supports-[backdrop-filter]:bg-background/85">
          {footer(false)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
