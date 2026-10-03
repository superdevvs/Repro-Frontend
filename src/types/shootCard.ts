/** Compact, authorized API representation returned only for view=card.
 * Full shoot details are loaded separately before editing or opening media.
 */
export interface ShootCard extends Record<string, unknown> {
  id: number | string;
  address?: string;
  scheduled_date?: string;
  status?: string;
  workflow_status?: string;
  services?: Array<{ id: string | number; name: string }>;
  service_items?: Array<Record<string, unknown>>;
  client?: { id: string | number; name: string } | null;
  photographer?: { id: string | number; name: string } | null;
  hero_image?: string | null;
  preview_images?: string[];
  media_summary?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  primary_action?: Record<string, unknown>;
  permissions?: Record<string, boolean>;
}
