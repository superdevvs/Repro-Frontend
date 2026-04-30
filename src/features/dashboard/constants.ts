export const WORKFLOW_SEQUENCE = [
  "booked",
  "photos_uploaded",
  "editing_complete",
  "pending_review",
  "admin_verified",
  "completed",
] as const;

export const CLIENT_DELIVERED_FLOORPLAN_PATTERNS = [
  "floorplan",
  "floor-plan",
  "floor_plan",
  "fp_",
  "fp-",
  "layout",
  "blueprint",
];

export const CLIENT_DELIVERED_FINAL_STAGE_KEYWORDS = [
  "verified",
  "completed",
  "edited",
  "delivered",
  "ready",
];

export const CLIENT_DELIVERED_EXCLUDED_STAGE_KEYWORDS = ["todo", "raw", "uploaded", "capture"];

export const ACTIVE_CLIENT_REQUEST_STATUSES = new Set(["open", "in-progress", "in_progress"]);

export const DASHBOARD_DESCRIPTION =
  "Here's an overview of all your shoots, approvals, and editing status.";
