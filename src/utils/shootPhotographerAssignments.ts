import { ShootServiceObject, ShootServicePhotographer } from '@/types/shoots';

type RawServiceAssignment = ShootServiceObject | Record<string, unknown>;
type AssignmentSource = {
  serviceObjects?: RawServiceAssignment[] | null;
  services?: unknown[] | null;
  photographer?: ShootServicePhotographer | null;
};

export interface ShootPhotographerAssignment {
  serviceId?: string;
  serviceName: string;
  categoryKey: string;
  categoryName: string;
  photographerId?: string;
  photographer: ShootServicePhotographer | null;
  raw: RawServiceAssignment;
}

export interface ShootPhotographerAssignmentGroup {
  key: string;
  name: string;
  photographer: ShootServicePhotographer | null;
  services: ShootPhotographerAssignment[];
}

export const normalizeShootServiceCategoryKey = (name: string) =>
  name.trim().toLowerCase().replace(/s$/, '');

const getServiceAssignmentSource = (
  shoot: AssignmentSource,
): RawServiceAssignment[] => {
  if (Array.isArray(shoot.serviceObjects) && shoot.serviceObjects.length > 0) {
    return shoot.serviceObjects;
  }

  if (Array.isArray(shoot.services)) {
    return shoot.services.filter(
      (service): service is RawServiceAssignment =>
        service !== null && typeof service === 'object',
    );
  }

  return [];
};

const normalizePhotographer = (
  photographer: unknown,
  fallbackId?: string,
  fallbackName?: string,
): ShootServicePhotographer | null => {
  if (photographer && typeof photographer === 'object') {
    const source = photographer as Record<string, unknown>;
    const photographerId =
      source.id != null ? String(source.id) : fallbackId;
    const photographerName =
      typeof source.name === 'string' && source.name.trim()
        ? source.name
        : typeof source.full_name === 'string' && source.full_name.trim()
        ? source.full_name
        : typeof source.display_name === 'string' && source.display_name.trim()
        ? source.display_name
        : fallbackName;

    if (photographerId || photographerName) {
      return {
        id: photographerId,
        name: photographerName || `Photographer #${photographerId}`,
        avatar:
          (typeof source.avatar === 'string' && source.avatar) ||
          (typeof source.profile_image === 'string' && source.profile_image) ||
          (typeof source.profile_photo_url === 'string' && source.profile_photo_url) ||
          undefined,
        email:
          typeof source.email === 'string' && source.email
            ? source.email
            : undefined,
      };
    }
  }

  if (fallbackId || fallbackName) {
    return {
      id: fallbackId,
      name: fallbackName || `Photographer #${fallbackId}`,
    };
  }

  return null;
};

export const getShootPhotographerAssignments = (
  shoot: AssignmentSource,
): ShootPhotographerAssignment[] => {
  const services = getServiceAssignmentSource(shoot);
  const shootPhotographerId = shoot.photographer?.id
    ? String(shoot.photographer.id)
    : undefined;

  return services.map((service) => {
    const rawService = service as Record<string, unknown>;
    const categoryName =
      (rawService.category &&
      typeof rawService.category === 'object' &&
      typeof (rawService.category as Record<string, unknown>).name === 'string'
        ? String((rawService.category as Record<string, unknown>).name)
        : undefined) ||
      (typeof rawService.category_name === 'string' && rawService.category_name) ||
      'Other';

    const photographerId =
      rawService.resolved_photographer_id != null
        ? String(rawService.resolved_photographer_id)
        : rawService.photographer_id != null
        ? String(rawService.photographer_id)
        : rawService.pivot &&
          typeof rawService.pivot === 'object' &&
          (rawService.pivot as Record<string, unknown>).photographer_id != null
        ? String((rawService.pivot as Record<string, unknown>).photographer_id)
        : rawService.photographer &&
          typeof rawService.photographer === 'object' &&
          (rawService.photographer as Record<string, unknown>).id != null
        ? String((rawService.photographer as Record<string, unknown>).id)
        : undefined;

    const photographer =
      normalizePhotographer(
        rawService.resolved_photographer ?? rawService.photographer,
        photographerId,
        typeof rawService.resolved_photographer_name === 'string'
          ? rawService.resolved_photographer_name
          : typeof rawService.photographer_name === 'string'
          ? rawService.photographer_name
          : undefined,
      ) ||
      (shootPhotographerId && photographerId && shootPhotographerId === photographerId
        ? {
            id: shootPhotographerId,
            name: shoot.photographer?.name || `Photographer #${shootPhotographerId}`,
            avatar: shoot.photographer?.avatar,
            email: shoot.photographer?.email,
          }
        : null);

    return {
      serviceId:
        rawService.id != null
          ? String(rawService.id)
          : rawService.service_id != null
          ? String(rawService.service_id)
          : undefined,
      serviceName:
        (typeof rawService.name === 'string' && rawService.name) ||
        (typeof rawService.label === 'string' && rawService.label) ||
        (typeof rawService.service_name === 'string' && rawService.service_name) ||
        'Unnamed service',
      categoryKey: normalizeShootServiceCategoryKey(categoryName),
      categoryName,
      photographerId,
      photographer,
      raw: service,
    };
  });
};

export const getShootPhotographerAssignmentGroups = (
  shoot: AssignmentSource,
) => {
  const assignments = getShootPhotographerAssignments(shoot);
  const groupsMap = new Map<string, ShootPhotographerAssignmentGroup>();

  assignments.forEach((assignment) => {
    const existingGroup = groupsMap.get(assignment.categoryKey);
    if (existingGroup) {
      existingGroup.services.push(assignment);
      if (!existingGroup.photographer && assignment.photographer) {
        existingGroup.photographer = assignment.photographer;
      }
      return;
    }

    groupsMap.set(assignment.categoryKey, {
      key: assignment.categoryKey,
      name: assignment.categoryName,
      photographer: assignment.photographer,
      services: [assignment],
    });
  });

  const groups = Array.from(groupsMap.values());
  const distinctPhotographerIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.photographerId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  return {
    assignments,
    groups,
    distinctPhotographerIds,
    hasAssignments: assignments.length > 0,
    hasMultipleCategories: groups.length > 1,
    hasMultiplePhotographers:
      distinctPhotographerIds.length > 1 ||
      (groups.length > 1 && groups.some((group) => group.photographer !== null)),
  };
};


export type AssignedShootPhotographer = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
};

/** Preview current service assignees without treating a stale primary as another assignment. */
export const getShootPhotographerDisplayName = (
  shoot: AssignmentSource & { serviceItems?: unknown[] | null },
): string => {
  const serviceItems = shoot.serviceItems?.filter(
    (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
  );
  const assignments = getShootPhotographerAssignments(
    serviceItems?.length ? { ...shoot, serviceObjects: serviceItems } : shoot,
  );
  const names = [...new Set(assignments.map((item) => item.photographer?.name).filter(Boolean))];
  return names.length ? names.join(' · ') : shoot.photographer?.name || 'Unassigned';
};

/**
 * Unique photographers on a shoot: shoot-level primary plus every service-level assignee.
 */
export const getShootAssignedPhotographers = (
  shoot: AssignmentSource & {
    serviceItems?: unknown[] | null;
    service_items?: unknown[] | null;
    photographer_id?: string | number | null;
  },
): AssignedShootPhotographer[] => {
  const byId = new Map<string, AssignedShootPhotographer>();

  const upsert = (id?: string | null, name?: string | null, email?: string | null, avatar?: string | null) => {
    if (!id) return;
    const existing = byId.get(id);
    byId.set(id, {
      id,
      name: (name && name.trim()) || existing?.name || `Photographer #${id}`,
      email: (email && email.trim()) || existing?.email,
      avatar: avatar || existing?.avatar,
    });
  };

  if (shoot.photographer?.id != null) {
    upsert(
      String(shoot.photographer.id),
      shoot.photographer.name,
      shoot.photographer.email,
      shoot.photographer.avatar,
    );
  } else if (shoot.photographer_id != null && shoot.photographer_id !== '') {
    upsert(String(shoot.photographer_id), null, null, null);
  }

  for (const assignment of getShootPhotographerAssignments(shoot)) {
    if (assignment.photographerId) {
      upsert(
        assignment.photographerId,
        assignment.photographer?.name,
        assignment.photographer?.email,
        assignment.photographer?.avatar,
      );
    }
  }

  const itemLists = [shoot.serviceItems, shoot.service_items].filter(Array.isArray) as Array<Array<Record<string, unknown>>>;
  for (const list of itemLists) {
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const photographer = item.photographer && typeof item.photographer === 'object'
        ? (item.photographer as Record<string, unknown>)
        : null;
      const id =
        item.photographer_id != null
          ? String(item.photographer_id)
          : photographer?.id != null
            ? String(photographer.id)
            : null;
      upsert(
        id,
        typeof photographer?.name === 'string' ? photographer.name : null,
        typeof photographer?.email === 'string' ? photographer.email : null,
        typeof photographer?.avatar === 'string' ? photographer.avatar : null,
      );
    }
  }

  return Array.from(byId.values());
};
