export const CATEGORY_SPECIALTY_PREFIX = 'category:';
export const CATEGORY_NAME_SPECIALTY_PREFIX = 'category-name:';

const normalizeCategoryName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const getCategorySpecialtyId = (category?: { id?: string | number | null; name?: string | null } | null) => {
  if (!category) return `${CATEGORY_NAME_SPECIALTY_PREFIX}other`;

  if (category.id !== undefined && category.id !== null && String(category.id).trim()) {
    return `${CATEGORY_SPECIALTY_PREFIX}${String(category.id)}`;
  }

  return `${CATEGORY_NAME_SPECIALTY_PREFIX}${normalizeCategoryName(category.name || 'Other') || 'other'}`;
};

export const hasCategorySpecialty = (
  specialties: Array<string | number>,
  categorySpecialtyId: string,
  categoryNameSpecialtyId: string,
  legacyServiceIds: Set<string>,
) =>
  specialties.some((specialty) => {
    const value = String(specialty);
    return value === categorySpecialtyId || value === categoryNameSpecialtyId || legacyServiceIds.has(value);
  });
