import type { ShootData } from "@/types/shoots";
import type { DashboardShootSummary } from "@/types/dashboard";
import { normalizeImageUrl } from "@/utils/imageUrl";

import {
  CLIENT_DELIVERED_EXCLUDED_STAGE_KEYWORDS,
  CLIENT_DELIVERED_FINAL_STAGE_KEYWORDS,
  CLIENT_DELIVERED_FLOORPLAN_PATTERNS,
} from "./constants";

export const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isDateWithinRange = (value: string | null | undefined, start: Date, end: Date) => {
  const parsed = parseDateValue(value);
  return Boolean(parsed && parsed >= start && parsed <= end);
};

export const getClientPaymentBadgeInfo = (
  status: DashboardShootSummary["paymentStatus"] | null | undefined,
) => {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        defaultClassName: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20",
        overlayClassName: "bg-emerald-500/25 text-emerald-200 border-emerald-400/30",
      };
    case "partial":
      return {
        label: "Partial",
        defaultClassName: "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20",
        overlayClassName: "bg-amber-500/25 text-amber-100 border-amber-400/30",
      };
    default:
      return {
        label: "Unpaid",
        defaultClassName: "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20",
        overlayClassName: "bg-rose-500/25 text-rose-100 border-rose-400/30",
      };
  }
};

export const buildShootHistoryPath = (
  tab: "scheduled" | "completed" | "delivered" | "hold" | "editing" | "edited",
  options?: { range?: "mtd" },
) => {
  const searchParams = new URLSearchParams({ tab });
  if (options?.range) {
    searchParams.set("range", options.range);
  }
  return `/shoot-history?${searchParams.toString()}`;
};

export const matchesClientDeliveredPattern = (value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.toLowerCase();
  return CLIENT_DELIVERED_FLOORPLAN_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const isClientDeliveredFloorplanLike = (item: unknown) => {
  if (typeof item === "string") {
    return matchesClientDeliveredPattern(item);
  }

  if (!item || typeof item !== "object") {
    return false;
  }

  const asset = item as Record<string, unknown>;
  const mediaType = String(asset.media_type ?? asset.mediaType ?? asset.type ?? "").toLowerCase();
  if (mediaType === "floorplan") {
    return true;
  }

  return [
    asset.filename,
    asset.stored_filename,
    asset.name,
    asset.path,
    asset.url,
    asset.thumbnail_url,
    asset.web_url,
    asset.large_url,
    asset.original_url,
  ].some(matchesClientDeliveredPattern);
};

export const getClientDeliveredWorkflowStage = (item: unknown) => {
  if (!item || typeof item !== "object") {
    return "";
  }

  const asset = item as Record<string, unknown>;
  return String(asset.workflow_stage ?? asset.workflowStage ?? "").toLowerCase();
};

export const isClientDeliveredFinalAsset = (item: unknown) => {
  const stage = getClientDeliveredWorkflowStage(item);
  if (!stage) {
    return false;
  }

  if (CLIENT_DELIVERED_EXCLUDED_STAGE_KEYWORDS.some((keyword) => stage.includes(keyword))) {
    return false;
  }

  return CLIENT_DELIVERED_FINAL_STAGE_KEYWORDS.some((keyword) => stage.includes(keyword));
};

export const resolveClientDeliveredAssetUrl = (item: unknown) => {
  if (typeof item === "string") {
    const resolved = normalizeImageUrl(item);
    return resolved || null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const asset = item as Record<string, unknown>;
  const candidates = [
    asset.thumbnail,
    asset.thumbnail_url,
    asset.thumbnail_path,
    asset.thumb,
    asset.thumb_url,
    asset.web_url,
    asset.web_path,
    asset.medium_url,
    asset.medium,
    asset.large_url,
    asset.large,
    asset.placeholder_url,
    asset.placeholder_path,
    asset.url,
    asset.path,
    asset.original_url,
    asset.original,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const resolved = normalizeImageUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const getClientDeliveredMedia = (shoot: ShootData) => {
  const editedFiles = (shoot.files ?? [])
    .filter((file) => !(file.is_hidden ?? false))
    .filter((file) => !isClientDeliveredFloorplanLike(file))
    .filter((file) => isClientDeliveredFinalAsset(file));

  const orderedEditedFiles = [
    ...editedFiles.filter((file) => Boolean(file.is_cover ?? file.isCover)),
    ...editedFiles.filter((file) => !(file.is_cover ?? file.isCover)),
  ];

  const filePhotos = Array.from(
    new Set(
      orderedEditedFiles
        .map((file) => resolveClientDeliveredAssetUrl(file))
        .filter((url): url is string => Boolean(url)),
    ),
  );

  const mediaPhotos = Array.from(
    new Set(
      (shoot.media?.images ?? [])
        .filter((image) => !isClientDeliveredFloorplanLike(image))
        .map((image) => resolveClientDeliveredAssetUrl(image))
        .filter((url): url is string => Boolean(url)),
    ),
  );

  const deliveredPhotoSource = Array.isArray((shoot as ShootData & { deliveredPhotos?: unknown[] }).deliveredPhotos)
    ? (shoot as ShootData & { deliveredPhotos?: unknown[] }).deliveredPhotos ?? []
    : [];

  const legacyDeliveredPhotos = Array.from(
    new Set(
      deliveredPhotoSource
        .filter((image) => !isClientDeliveredFloorplanLike(image))
        .map((image) => resolveClientDeliveredAssetUrl(image))
        .filter((url): url is string => Boolean(url)),
    ),
  );

  const photos =
    filePhotos.length > 0
      ? filePhotos
      : mediaPhotos.length > 0
        ? mediaPhotos
        : legacyDeliveredPhotos;

  const countFallbacks = [
    shoot.editedPhotoCount,
    shoot.mediaSummary?.editedUploaded,
    shoot.mediaSummary?.delivered,
  ];

  const explicitCount = countFallbacks.find(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  return {
    photos,
    coverPhoto: photos[0] ?? null,
    count: explicitCount ?? photos.length,
  };
};
