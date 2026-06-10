import { apiClient } from './api';
import type { ServiceAreaKind } from './serviceArea';

/**
 * Test_Shoot generator/simulator client (Req 10.7-10.11).
 *
 * Wraps the three backend seams exposed by `TestShootController`
 * (see backend/routes/api.php, mounted under auth:sanctum + admin roles):
 *   - createTestShoot : POST /admin/test-shoots                                 (AC 10.7)
 *   - previewEligible : GET  /admin/test-shoots/{shoot}/eligible-photographers  (AC 10.8)
 *   - assignTestShoot : POST /admin/test-shoots/{shoot}/assign                  (AC 10.9)
 *
 * A Test_Shoot is a real Shoot row marked `shoot_type = internal_test`, scoped to a
 * region/state/area and carrying the region timezone. Once assigned it flows through
 * the same schedule query as a real shoot (AC 10.10) and renders on its scheduled
 * calendar day in the region timezone (AC 10.11).
 */

/** Compact Test_Shoot shape returned by the admin endpoints. */
export interface TestShoot {
  id: number;
  shoot_type: string;
  status: string;
  service_area_kind: ServiceAreaKind | string;
  service_area_value: string;
  /** IANA timezone of the Test_Shoot's region (e.g. "America/New_York"). */
  timezone: string | null;
  /** ISO-8601 absolute instant the Test_Shoot is scheduled for. */
  scheduled_at: string | null;
  /** Local calendar day (YYYY-MM-DD) in the region timezone — never re-shifted. */
  scheduled_date: string;
  photographer_id: number | null;
}

export interface EligiblePhotographer {
  id: number;
  name: string;
  email: string;
  service_areas: Array<{
    id: number;
    kind: ServiceAreaKind | string;
    value: string;
    label?: string | null;
  }>;
}

export interface CreateTestShootRequest {
  kind: ServiceAreaKind;
  value: string;
  /** ISO-8601 datetime the Test_Shoot is scheduled for. */
  scheduled_at: string;
  /** IANA timezone of the region (e.g. "America/New_York"). */
  timezone: string;
}

export interface CreateTestShootResponse {
  shoot: TestShoot;
}

export interface EligiblePhotographersResponse {
  shoot_id: number;
  service_area: { kind: ServiceAreaKind | string; value: string };
  photographers: EligiblePhotographer[];
}

export interface AssignTestShootResponse {
  assigned: boolean;
  shoot: TestShoot;
}

/** POST /admin/test-shoots — create a Test_Shoot scoped to a region/state/area (AC 10.7). */
export const createTestShoot = async (
  payload: CreateTestShootRequest,
): Promise<CreateTestShootResponse> => {
  const response = await apiClient.post<CreateTestShootResponse>('/admin/test-shoots', payload);
  return response.data;
};

/**
 * GET /admin/test-shoots/{shoot}/eligible-photographers — list photographers whose
 * service areas match the Test_Shoot's scope (AC 10.8).
 */
export const previewEligiblePhotographers = async (
  shootId: number,
): Promise<EligiblePhotographersResponse> => {
  const response = await apiClient.get<EligiblePhotographersResponse>(
    `/admin/test-shoots/${shootId}/eligible-photographers`,
  );
  return response.data;
};

/** POST /admin/test-shoots/{shoot}/assign — assign + link a photographer (AC 10.9). */
export const assignTestShoot = async (
  shootId: number,
  userId: number,
): Promise<AssignTestShootResponse> => {
  const response = await apiClient.post<AssignTestShootResponse>(
    `/admin/test-shoots/${shootId}/assign`,
    { user_id: userId },
  );
  return response.data;
};
