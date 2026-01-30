
import React from 'react';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const { data: categories, isLoading } = useServiceCategories();

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

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <div className="flex items-center justify-center h-10 border rounded-md">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="category">Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="category" className="bg-background">
          <SelectValue placeholder="Select a category" />
        </SelectTrigger>
        <SelectContent>
          {mergedCategories.length > 0 ? (
            mergedCategories.map((category) => {
              const displayName = normalizeCategoryName(category.name) === 'photos'
                ? 'Photos'
                : category.name;
              return (
                <SelectItem key={category.id} value={String(category.id)}>
                  {displayName}
                </SelectItem>
              );
            })
          ) : (
            <SelectItem value="no-categories" disabled>
              No categories available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
