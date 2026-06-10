import { apiClient } from './api';

/**
 * Photographer service-area assignment client (Req 10).
 *
 * Wraps the four backend seams exposed by `ServiceAreaController`:
 *   - assign  : POST /admin/photographers/{user}/service-areas      (AC 10.1, 10.4)
 *   - filter  : GET  /admin/service-area/photographers              (AC 10.2)
 *   - preview : POST /admin/assignments/preview                     (AC 10.3, 10.5)
 *   - commit  : POST /admin/assignments/commit                      (AC 10.4)
 *
 * `preview` and `commit` share the same match step on the backend, so the previewed
 * match list is identical to what `commit` would compute. Only `commit` persists.
 */

export type ServiceAreaKind = 'region' | 'state' | 'area';

export const SERVICE_AREA_KINDS: ServiceAreaKind[] = ['region', 'state', 'area'];

export interface ServiceArea {
  id: number;
  kind: ServiceAreaKind;
  value: string;
  label?: string | null;
}

export interface ServiceAreaFilter {
  kind: ServiceAreaKind;
  value: string;
}

export interface ServiceAreaPhotographer {
  id: number;
  name: string;
  email: string;
  service_areas: ServiceArea[];
}

export interface PreviewResponse {
  preview: true;
  filter: ServiceAreaFilter;
  photographers: ServiceAreaPhotographer[];
}

export interface FilterResponse {
  filter: ServiceAreaFilter;
  photographers: ServiceAreaPhotographer[];
}

export interface CommitResponse {
  committed: true;
  filter: ServiceAreaFilter;
  user_id: number;
  assigned: ServiceArea[];
  photographers: ServiceAreaPhotographer[];
}

export interface AssignResponse {
  user_id: number;
  service_areas: ServiceArea[];
}

const filterParams = (filter: ServiceAreaFilter) => ({
  service_area_kind: filter.kind,
  service_area_value: filter.value,
});

/** GET /admin/service-area/photographers — list photographers matching a filter (AC 10.2). */
export const filterPhotographersByServiceArea = async (
  filter: ServiceAreaFilter,
): Promise<FilterResponse> => {
  const response = await apiClient.get<FilterResponse>('/admin/service-area/photographers', {
    params: filterParams(filter),
  });
  return response.data;
};

/** POST /admin/assignments/preview — preview matches without persisting (AC 10.3, 10.5). */
export const previewServiceAreaAssignment = async (
  filter: ServiceAreaFilter,
): Promise<PreviewResponse> => {
  const response = await apiClient.post<PreviewResponse>(
    '/admin/assignments/preview',
    filterParams(filter),
  );
  return response.data;
};

/** POST /admin/assignments/commit — persist a previewed assignment (AC 10.4). */
export const commitServiceAreaAssignment = async (
  filter: ServiceAreaFilter,
  userId: number,
): Promise<CommitResponse> => {
  const response = await apiClient.post<CommitResponse>('/admin/assignments/commit', {
    ...filterParams(filter),
    user_id: userId,
  });
  return response.data;
};

/**
 * POST /admin/photographers/{user}/service-areas — assign one or more service areas
 * (kind/value pairs) to a photographer in a single transactional write (AC 10.1, 10.4).
 */
export const assignServiceAreasToPhotographer = async (
  userId: number,
  serviceAreas: Array<{ kind: ServiceAreaKind; value: string; label?: string | null }>,
): Promise<AssignResponse> => {
  const response = await apiClient.post<AssignResponse>(
    `/admin/photographers/${userId}/service-areas`,
    { service_areas: serviceAreas },
  );
  return response.data;
};

/** Lightweight admin photographer record returned by /admin/photographers. */
export interface AdminPhotographer {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

/** GET /admin/photographers — full photographer directory used to pick a commit target. */
export const listAdminPhotographers = async (): Promise<AdminPhotographer[]> => {
  const response = await apiClient.get<{ status?: string; data?: AdminPhotographer[] }>(
    '/admin/photographers',
  );
  const raw = response.data?.data ?? [];
  return Array.isArray(raw) ? raw : [];
};
