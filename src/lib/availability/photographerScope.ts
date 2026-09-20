import type { Photographer } from "@/types/availability";

export interface AvailabilityViewer {
  isPhotographer: boolean;
  userId?: string | number | null;
  name?: string | null;
}

const viewerId = (viewer: AvailabilityViewer): string | null =>
  viewer.userId === undefined || viewer.userId === null || viewer.userId === ""
    ? null
    : String(viewer.userId);

export const scopePhotographersForViewer = (
  photographers: Photographer[],
  viewer: AvailabilityViewer,
): Photographer[] => {
  if (!viewer.isPhotographer) return photographers;

  const id = viewerId(viewer);
  if (!id) return [];

  const self = photographers.find((photographer) => String(photographer.id) === id);
  return [self ?? { id, name: viewer.name?.trim() || "You" }];
};

export const resolveSelectedPhotographer = (
  selected: string,
  viewer: AvailabilityViewer,
): string => {
  if (!viewer.isPhotographer) return selected;
  return viewerId(viewer) ?? selected;
};
