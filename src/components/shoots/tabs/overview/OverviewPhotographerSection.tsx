import { CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShootData } from '@/types/shoots';
import type { PhotographerPickerOption } from './useShootOverviewEditor';

type PhotographerSummary = {
  id?: string | number;
  name?: string;
  email?: string;
} | null | undefined;

type PhotographerGroup = {
  key: string;
  name: string;
  photographer?: PhotographerSummary;
};

type OverviewPhotographerSectionProps = {
  shoot: ShootData;
  isEditMode: boolean;
  isPhotographer: boolean;
  isClient: boolean;
  photographerAssignments: {
    groups: PhotographerGroup[];
    hasAssignments: boolean;
    hasMultiplePhotographers: boolean;
  };
  editModePhotographerRows: PhotographerGroup[];
  perCategoryPhotographers: Record<string, string>;
  selectedPhotographerIdEdit: string;
  resolvePhotographerDetails: (photographerId?: string | null) => PhotographerPickerOption | PhotographerSummary;
  openEditPhotographerPicker: (context: { source: 'edit'; categoryKey?: string; categoryName?: string }) => void;
};

export function OverviewPhotographerSection({
  shoot,
  isEditMode,
  isPhotographer,
  isClient,
  photographerAssignments,
  editModePhotographerRows,
  perCategoryPhotographers,
  selectedPhotographerIdEdit,
  resolvePhotographerDetails,
  openEditPhotographerPicker,
}: OverviewPhotographerSectionProps) {
  if (isPhotographer || (!shoot.photographer && !isEditMode && !photographerAssignments.hasAssignments)) {
    return null;
  }

  const categoryEntries = isEditMode ? editModePhotographerRows : photographerAssignments.groups;
  const distinctPhotographerIds = Array.from(
    new Set(
      categoryEntries
        .map((group) => group.photographer?.id)
        .filter((id): id is string | number => Boolean(id)),
    ),
  );
  const hasMultiplePhotographers = isEditMode
    ? distinctPhotographerIds.length > 1
    : photographerAssignments.hasMultiplePhotographers;
  const hasMultipleCategories = categoryEntries.length > 1;
  const displayedPhotographer = isEditMode
    ? resolvePhotographerDetails(selectedPhotographerIdEdit) || categoryEntries[0]?.photographer
    : shoot.photographer || categoryEntries[0]?.photographer;

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <CameraIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          {(isEditMode ? hasMultipleCategories : hasMultiplePhotographers) ? 'Photographers' : 'Photographer'}
        </span>
      </div>
      {isEditMode ? (
        <div className="space-y-2">
          {(hasMultipleCategories ? editModePhotographerRows : editModePhotographerRows.slice(0, 1)).map((group) => {
            const selectedPhotographer = resolvePhotographerDetails(
              perCategoryPhotographers[group.key] || String(group.photographer?.id || selectedPhotographerIdEdit || ''),
            );

            return (
              <div
                key={group.key}
                className="flex items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-1 text-xs">
                  {hasMultipleCategories && (
                    <div className="text-[10px] font-medium uppercase text-muted-foreground">
                      {group.name}
                    </div>
                  )}
                  <div className="font-medium">
                    {selectedPhotographer?.name || 'Not assigned'}
                  </div>
                  {!isClient && selectedPhotographer?.email && (
                    <div className="truncate text-muted-foreground">
                      {selectedPhotographer.email}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() =>
                    openEditPhotographerPicker({
                      source: 'edit',
                      categoryKey: hasMultipleCategories ? group.key : undefined,
                      categoryName: hasMultipleCategories ? group.name : undefined,
                    })
                  }
                >
                  Edit photographer
                </Button>
              </div>
            );
          })}
        </div>
      ) : hasMultiplePhotographers ? (
        <div className="space-y-1.5">
          {categoryEntries.map((group) => {
            const photographer = group.photographer || shoot.photographer;
            return (
              <div key={group.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[10px] font-medium text-muted-foreground uppercase truncate">
                  {group.name}
                </span>
                <span className="font-medium truncate">
                  {photographer?.name || 'Not assigned'}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          <div className="font-medium">{displayedPhotographer?.name || 'Not assigned'}</div>
          {!isClient && displayedPhotographer?.email && (
            <div className="text-muted-foreground truncate">
              {displayedPhotographer.email}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
