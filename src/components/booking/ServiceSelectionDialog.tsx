import React from 'react';
import { ArrowRight } from 'lucide-react';

import { ServicePickerIcon } from './ServicePickerIcon';
import { serviceCategoryIcon } from './serviceCategoryIcon';
import { ServicePickerCard } from './ServicePickerCard';
import './service-picker.css';
import { Button } from '@/components/ui/button';
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
  DrawerClose,
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
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';

export type ServiceSelectionOption = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | string | null;
  category?: { id?: string | number; name?: string | null } | string | null;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: unknown[];
  delivery_time?: unknown;
  photographer_required?: boolean | null;
  photographer_pay?: unknown;
  allow_multiple?: boolean;
  /** Number of booked items. Catalog package counts are not booking quantities. */
  quantity?: number;
};

type CategoryDisplay = {
  id: string;
  name: string;
  count: number;

};

type ServiceSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceSelectionOption[];
  selectedServices: ServiceSelectionOption[];
  onSelectedServicesChange: (services: ServiceSelectionOption[]) => void;
  servicesLoading?: boolean;
  effectiveSqft?: number | null;
  allowEmptySelection?: boolean;
  title?: string;
  description?: string;
  contextualControls?: React.ReactNode;
  renderServicePrice?: (service: ServiceSelectionOption, defaultLabel: string) => React.ReactNode;
  selectionSummary?: React.ReactNode;
  compact?: boolean;
  selectionMode?: 'multiple' | 'single';
  hidePrices?: boolean;
};

const FALLBACK_CATEGORY_NAME = 'More services';

const selectedQuantity = (service: ServiceSelectionOption) => normalizeBookingQuantity(service.quantity);

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

const getServiceSqftRanges = (service?: ServiceSelectionOption | ServiceWithPricing | null) => {
  const serviceWithAliases = service as (ServiceSelectionOption & { sqftRanges?: unknown[] }) | null | undefined;
  return (serviceWithAliases?.sqft_ranges || serviceWithAliases?.sqftRanges || []) as SqftRange[];
};

export function ServiceSelectionDialog({
  open,
  onOpenChange,
  services,
  selectedServices,
  onSelectedServicesChange,
  servicesLoading = false,
  effectiveSqft,
  allowEmptySelection = false,
  title = 'Choose your services',
  description = 'Select services and review your total.',
  contextualControls,
  renderServicePrice,
  selectionSummary,
  compact = false,
  selectionMode = 'multiple',
  hidePrices = false,
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

      });
    });

    return [{ id: 'all', name: 'All services', count: services.length }, ...Array.from(categories.values()).sort((first, second) => {
      const firstKey = Object.keys(PRIMARY_CATEGORY_ORDER).find((key) => first.name.toLowerCase().includes(key));
      const secondKey = Object.keys(PRIMARY_CATEGORY_ORDER).find((key) => second.name.toLowerCase().includes(key));
      const firstScore = firstKey ? PRIMARY_CATEGORY_ORDER[firstKey] : Number.MAX_SAFE_INTEGER;
      const secondScore = secondKey ? PRIMARY_CATEGORY_ORDER[secondKey] : Number.MAX_SAFE_INTEGER;
      if (firstScore === secondScore) return first.name.localeCompare(second.name);
      return firstScore - secondScore;
    })];
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
    let filtered = panelCategory !== 'all'
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
        return total + (Number.isFinite(numericPrice) ? numericPrice * selectedQuantity(service) : 0);
      }, 0),
    [selectedServices],
  );

  const selectedItemCount = selectedServices.reduce((count, service) => count + selectedQuantity(service), 0);

  const selectedCountByCategory = React.useMemo(() => {
    const counts = new Map<string, number>();

    selectedServices.forEach((service) => {
      const categoryId = getServiceCategoryId(service);
      counts.set(categoryId, (counts.get(categoryId) || 0) + selectedQuantity(service));
    });

    return counts;
  }, [selectedServices]);

  const isServiceSelected = (serviceId: string) =>
    selectedServices.some((service) => String(service.id) === String(serviceId));

  const addService = (service: ServiceSelectionOption) => {
    let adjustedService = { ...service, id: String(service.id), quantity: 1 };
    const sqftRanges = getServiceSqftRanges(service);
    if (service.pricing_type === 'variable' && effectiveSqft && sqftRanges.length) {
      const pricingInfo = getServicePricingForSqft({ ...service, sqft_ranges: sqftRanges } as ServiceWithPricing, effectiveSqft);
      adjustedService = { ...adjustedService, price: pricingInfo.price };
    }

    onSelectedServicesChange(selectionMode === 'single' ? [adjustedService] : [...selectedServices, adjustedService]);

    if (isMobile && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  };

  const toggleServiceSelection = (service: ServiceSelectionOption) => {
    const serviceId = String(service.id);
    if (isServiceSelected(serviceId)) {
      if (!allowEmptySelection && selectedServices.length === 1) return;
      onSelectedServicesChange(selectedServices.filter((selected) => String(selected.id) !== serviceId));
      return;
    }
    addService(service);
  };

  const changeQuantity = (service: ServiceSelectionOption, delta: -1 | 1) => {
    if (!service.allow_multiple) return;
    const selected = selectedServices.find((item) => String(item.id) === String(service.id));
    if (!selected) {
      if (delta > 0) addService(service);
      return;
    }
    const quantity = Math.max(1, selectedQuantity(selected) + delta);
    onSelectedServicesChange(selectedServices.map((item) => item === selected ? { ...item, quantity } : item));
  };


  const selectedNames = selectedServices.map(service => `${selectedQuantity(service) > 1 ? `${selectedQuantity(service)} × ` : ''}${service.name}`).join(' · ');
  const headerContext = effectiveSqft ? <span className="shrink-0 rounded-lg bg-[var(--picker-subtle)] px-2 py-2 text-xs text-[var(--picker-muted)]">{effectiveSqft.toLocaleString()} sq ft</span> : null;
  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
      <aside className="shrink-0 border-b border-[var(--picker-border)] bg-[var(--picker-subtle)] p-3 sm:w-[220px] sm:overflow-y-auto sm:border-b-0 sm:p-6">
        <p className="mb-2 hidden text-[11px] font-semibold uppercase text-[var(--picker-muted)] sm:block">Categories</p>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
          {categoryOptions.map(category => {
            const active = category.id === panelCategory;
            const selectedCount = category.id === 'all' ? selectedItemCount : (selectedCountByCategory.get(category.id) || 0);
            return <button key={category.id} type="button" aria-pressed={active} onClick={() => setPanelCategory(category.id)}
              className={cn('relative flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--picker-accent)] sm:w-full',
                active ? 'bg-[var(--picker-tint)] text-[var(--picker-accent)]' : 'text-[var(--picker-muted)] hover:bg-[var(--picker-tint)]')}>
              <ServicePickerIcon small name={category.id === 'all' ? 'grid' : serviceCategoryIcon(category.name)} />
              <span className="min-w-0 flex-1 whitespace-nowrap font-medium sm:whitespace-normal">{category.name}</span>
              <span className="text-xs tabular-nums" aria-label={`${category.count} services`}>{category.count}</span>
              {selectedCount > 0 && <span className="sr-only">{selectedCount} selected</span>}
            </button>;
          })}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div data-testid="service-picker-toolbar" className="flex shrink-0 flex-col gap-3 border-b border-[var(--picker-border)] bg-[var(--picker-surface)] p-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold sm:text-lg">{compact ? 'Services from this shoot' : panelCategory === 'all' ? 'Explore services' : categoryOptions.find(c => c.id === panelCategory)?.name}</h3>
            <span className="shrink-0 rounded-lg bg-[var(--picker-tint)] px-2 py-1.5 text-xs text-[var(--picker-accent)]">{selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'} selected</span>
          </div>
          <div className="relative w-full shrink-0 lg:w-[min(45%,360px)]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--picker-muted)]"><ServicePickerIcon small name="search" /></span>
            <Input type="search" aria-label="Search services" placeholder="Search services..." value={serviceSearchQuery}
              onChange={event => setServiceSearchQuery(event.target.value)}
              className="h-10 rounded-[10px] border-[var(--picker-border)] bg-[var(--picker-subtle)] pl-10 text-sm placeholder:text-[var(--picker-muted)]" />
          </div>
        </div>
        <div data-testid="service-picker-results" className="service-picker-body min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {servicesLoading ? <div className="service-picker-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-52 rounded-[14px]" />)}</div>
          : panelServices.length ? <div className="service-picker-grid">
            {panelServices.map(service => {
              const selected = selectedServices.find(item => String(item.id) === String(service.id));
              const ranges = getServiceSqftRanges(service);
              const pricing = service.pricing_type === 'variable' && effectiveSqft && ranges.length
                ? getServicePricingForSqft({ ...service, sqft_ranges: ranges } as ServiceWithPricing, effectiveSqft) : null;
              const unitPrice = Number(selected?.price ?? pricing?.price ?? service.price ?? 0);
              const quantity = selected ? selectedQuantity(selected) : 0;
              const multiple = !!service.allow_multiple && selectionMode !== 'single';
              const displayPrice = formatPrice(unitPrice * (selected ? quantity : 1));
              const tier = pricing?.matchedRange;
              const priceContext = hidePrices ? null : compact ? 'Original shoot service' : multiple ? `${formatPrice(unitPrice)} per item`
                : tier ? `${tier.sqft_from.toLocaleString()}–${tier.sqft_to.toLocaleString()} sq ft tier`
                : service.pricing_type === 'variable' && !effectiveSqft ? 'Add square footage for accurate pricing' : 'Flat price';
              return <ServicePickerCard key={service.id} name={service.name} description={service.description} category={getServiceCategoryName(service)}
                price={hidePrices ? null : renderServicePrice ? renderServicePrice(service, displayPrice) : displayPrice}
                priceContext={priceContext} selected={!!selected} quantity={quantity} multiple={multiple}
                onToggle={() => toggleServiceSelection(service)} onQuantity={delta => changeQuantity(service, delta)} />;
            })}
          </div> : <div className="rounded-xl border border-dashed border-[var(--picker-border)] bg-[var(--picker-subtle)] p-6 text-sm text-[var(--picker-muted)]">
            {serviceSearchQuery.trim() ? 'No services match this search in the selected category.' : 'No services exist in this category yet. Pick a different category to continue.'}
          </div>}
        </div>
      </div>
    </div>
  );
  const footer = <>
    <div className="min-w-0 flex-1">
      <p aria-live="polite" className="text-sm font-medium">{selectionSummary ?? `${selectedItemCount} ${selectedItemCount === 1 ? 'item' : 'items'} selected`}</p>
      <p className="mt-1 truncate text-xs text-[var(--picker-muted)]" title={selectedNames}>{selectedNames || 'Choose a service to get started'}</p>
      {!allowEmptySelection && selectedServices.length <= 1 && <p className="mt-1 text-xs text-[var(--picker-muted)]">At least one service is required for your role.</p>}
    </div>
    {!selectionSummary && !hidePrices && <span className="shrink-0 text-lg font-semibold tabular-nums sm:text-[22px]">{formatPrice(selectedServicesTotal)}</span>}
    <Button type="button" className="service-picker-done shrink-0 px-4 sm:px-6" disabled={!allowEmptySelection && !selectedServices.length} onClick={() => onOpenChange(false)}>
      <span className="sm:hidden">Done</span><span className="hidden sm:inline">Done selecting</span><ArrowRight className="ml-2 hidden h-4 w-4 sm:block" />
    </Button>
  </>;
  if (isMobile) return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent data-testid="service-picker" className="service-picker h-[92dvh] max-h-[92dvh] overflow-hidden rounded-t-[20px] [&>div:first-child]:mt-2 [&>div:first-child]:h-1 [&>div:first-child]:w-10">
      <DrawerHeader className="flex shrink-0 items-center gap-3 border-b border-[var(--picker-border)] p-4 text-left">
        <div className="min-w-0 flex-1"><DrawerTitle className="text-lg leading-snug">{title}</DrawerTitle><DrawerDescription className="mt-1 text-xs text-[var(--picker-muted)]">{description}</DrawerDescription></div>
        {headerContext}
        <DrawerClose aria-label="Close service picker" className="rounded-md p-2 focus-visible:ring-2 focus-visible:ring-primary"><ServicePickerIcon name="close" /></DrawerClose>
      </DrawerHeader>
      <div className="max-h-[32dvh] shrink-0 overflow-y-auto">{contextualControls}</div>
      {body}
      <DrawerFooter className="flex shrink-0 flex-row items-center gap-3 border-t border-[var(--picker-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>
    </DrawerContent>
  </Drawer>;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid="service-picker" className={cn('service-picker flex max-h-[92dvh] w-[96vw] !max-w-[1280px] flex-col gap-0 overflow-hidden rounded-[20px] p-0 [&>button]:right-3 [&>button]:top-5 [&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none', compact ? 'h-[min(624px,92dvh)]' : 'h-[min(798px,92dvh)]')}>
      <DialogHeader className="m-0 flex shrink-0 flex-row items-center gap-4 space-y-0 border-b border-[var(--picker-border)] p-4 pr-14 text-left">
        <div className="min-w-0 flex-1"><DialogTitle className="text-lg leading-snug">{title}</DialogTitle><DialogDescription className="mt-1 text-xs text-[var(--picker-muted)]">{description}</DialogDescription></div>
        {headerContext}
      </DialogHeader>
      <div className="max-h-[28dvh] shrink-0 overflow-y-auto">{contextualControls}</div>
      {body}
      <DialogFooter className="flex shrink-0 flex-row items-center gap-4 space-x-0 border-t border-[var(--picker-border)] p-4 sm:p-6">{footer}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
