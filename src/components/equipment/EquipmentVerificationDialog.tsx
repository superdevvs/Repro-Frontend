import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/services/api";
import {
  equipmentStatusLabel,
  type PhotographerEquipment,
  type PhotographerEquipmentPhoto,
} from "@/services/photographerEquipmentService";

const formatPhotoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatPhotoSize = (value?: number | null) => {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const detectImageMimeType = (buffer: ArrayBuffer, fallback?: string | null) => {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  try {
    const text = new TextDecoder().decode(buffer.slice(0, 512)).trim().toLowerCase();
    if (text.startsWith("<svg") || text.startsWith("<?xml") || text.includes("<svg")) return "image/svg+xml";
  } catch {
    return fallback?.startsWith("image/") ? fallback : "application/octet-stream";
  }

  return fallback?.startsWith("image/") ? fallback : "application/octet-stream";
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("Unable to read image"));
  reader.readAsDataURL(blob);
});

type EquipmentVerificationDialogProps = {
  equipment: PhotographerEquipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerLabel?: "admin" | "photographer";
};

export function EquipmentVerificationDialog({ equipment, open, onOpenChange, viewerLabel = "admin" }: EquipmentVerificationDialogProps) {
  const [previewPhoto, setPreviewPhoto] = useState<PhotographerEquipmentPhoto | null>(null);
  const [photoDataUrls, setPhotoDataUrls] = useState<Record<number, string>>({});
  const [photoLoadingIds, setPhotoLoadingIds] = useState<Record<number, boolean>>({});
  const [photoErrorIds, setPhotoErrorIds] = useState<Record<number, string>>({});

  const referencePhotos = useMemo(
    () => equipment?.photos.filter((photo) => photo.type === "admin_reference") || [],
    [equipment],
  );
  const submittedPhotos = useMemo(
    () => equipment?.photos.filter((photo) => photo.type === "photographer_verification") || [],
    [equipment],
  );

  useEffect(() => {
    if (!open || !equipment) return;
    setPreviewPhoto((current) => current && equipment.photos.some((photo) => photo.id === current.id)
      ? current
      : submittedPhotos[0] || referencePhotos[0] || null);
  }, [equipment, open, referencePhotos, submittedPhotos]);

  useEffect(() => {
    if (!open || !equipment) return;

    equipment.photos.forEach(async (photo) => {
      if (photoDataUrls[photo.id] || photoLoadingIds[photo.id]) return;

      setPhotoLoadingIds((current) => ({ ...current, [photo.id]: true }));
      setPhotoErrorIds((current) => {
        const next = { ...current };
        delete next[photo.id];
        return next;
      });

      try {
        const response = await apiClient.get<ArrayBuffer>(photo.url, {
          responseType: "arraybuffer",
          headers: { Accept: "image/*,*/*" },
        });
        const responseContentType = String(response.headers?.["content-type"] || "");
        const mimeType = detectImageMimeType(response.data, responseContentType || photo.mime_type);
        if (!mimeType.startsWith("image/")) {
          throw new Error(`Unexpected photo response type: ${mimeType}`);
        }
        const dataUrl = await blobToDataUrl(new Blob([response.data], { type: mimeType }));
        setPhotoDataUrls((current) => ({ ...current, [photo.id]: dataUrl }));
      } catch (error) {
        console.error("Failed to load equipment photo", error);
        setPhotoErrorIds((current) => ({ ...current, [photo.id]: "Unable to load image" }));
      } finally {
        setPhotoLoadingIds((current) => {
          const next = { ...current };
          delete next[photo.id];
          return next;
        });
      }
    });
  }, [equipment, open, photoDataUrls, photoLoadingIds]);

  const renderPhotoTile = (photo: PhotographerEquipmentPhoto, index: number, label: string) => {
    const imageUrl = photoDataUrls[photo.id];
    const isSelected = previewPhoto?.id === photo.id;
    const photoDate = formatPhotoDate(photo.created_at);
    const photoSize = formatPhotoSize(photo.size);

    return (
      <button
        key={photo.id}
        type="button"
        onClick={() => setPreviewPhoto(photo)}
        className={`group overflow-hidden rounded-xl border text-left transition ${
          isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border/70 bg-background hover:border-primary/60"
        }`}
      >
        <div className="relative aspect-[4/3] bg-muted/40">
          {imageUrl ? (
            <img src={imageUrl} alt={photo.original_name || `${label} ${index + 1}`} className="h-full w-full object-contain p-1 transition group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
              {photoErrorIds[photo.id] || (photoLoadingIds[photo.id] ? "Loading..." : "Image")}
            </div>
          )}
        </div>
        <div className="space-y-1 p-2">
          <div className="truncate text-xs font-medium">{photo.original_name || `${label} ${index + 1}`}</div>
          {(photoDate || photoSize) && (
            <div className="truncate text-[11px] text-muted-foreground">
              {[photoDate, photoSize].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </button>
    );
  };

  const renderPhotoSection = (title: string, description: string, photos: PhotographerEquipmentPhoto[], emptyText: string) => (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{photos.length}</Badge>
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          {photos.map((photo, index) => renderPhotoTile(photo, index, title))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );

  const previewPhotoUrl = previewPhoto ? photoDataUrls[previewPhoto.id] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b border-border/70 px-4 py-4 pr-12 text-left sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="truncate text-xl">Equipment Verification</DialogTitle>
              <DialogDescription>
                {viewerLabel === "photographer"
                  ? "Review admin reference images and your submitted verification images."
                  : "Compare admin reference images with the photographer verification submission."}
              </DialogDescription>
            </div>
            {equipment && (
              <Badge variant={equipment.status === "verified" ? "default" : equipment.status === "rejected" ? "destructive" : "outline"} className="w-fit">
                {equipmentStatusLabel(equipment.status)}
              </Badge>
            )}
          </div>
          {equipment && (
            <div className="mt-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                <span className="font-semibold">{equipment.name}</span>
                <span className="text-muted-foreground">{equipment.photographer?.name || "Assigned equipment"}</span>
                {equipment.serial_number && (
                  <span className="text-muted-foreground">Serial {equipment.serial_number}</span>
                )}
              </div>
            </div>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-black/80">
              <div className="flex min-h-[320px] items-center justify-center sm:min-h-[520px]">
                {previewPhoto && previewPhotoUrl ? (
                  <img
                    src={previewPhotoUrl}
                    alt={previewPhoto.original_name || "Equipment verification preview"}
                    className="max-h-[70vh] w-full object-contain"
                  />
                ) : previewPhoto ? (
                  <div className="p-6 text-center text-sm text-white/70">
                    {photoErrorIds[previewPhoto.id] || "Loading image..."}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-white/70">
                    No verification or admin reference images have been uploaded yet.
                  </div>
                )}
              </div>
              {previewPhoto && (
                <div className="border-t border-white/10 bg-black/60 px-4 py-3 text-sm text-white/80">
                  <div className="truncate font-medium">{previewPhoto.original_name || "Equipment image"}</div>
                  <div className="mt-1 text-xs text-white/55">
                    {[
                      previewPhoto.type === "admin_reference" ? "Admin reference" : "Photographer verification",
                      formatPhotoDate(previewPhoto.created_at),
                      formatPhotoSize(previewPhoto.size),
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {renderPhotoSection(
                "Photographer Verification",
                "Images submitted by the photographer for this equipment.",
                submittedPhotos,
                "No photographer verification images submitted yet.",
              )}
              {renderPhotoSection(
                "Admin Reference",
                "Reference images uploaded by admins for comparison.",
                referencePhotos,
                "No admin reference images uploaded yet.",
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border/70 px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
