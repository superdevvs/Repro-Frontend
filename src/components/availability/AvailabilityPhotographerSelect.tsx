import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Photographer } from "@/types/availability";
import { cn } from "@/lib/utils";

interface AvailabilityPhotographerSelectProps {
  canManagePhotographerSelection: boolean;
  photographers: Photographer[];
  selectedPhotographer: string;
  onSelect: (photographerId: string) => void;
  className?: string;
}

export function AvailabilityPhotographerSelect({
  canManagePhotographerSelection,
  photographers,
  selectedPhotographer,
  onSelect,
  className,
}: AvailabilityPhotographerSelectProps) {
  if (!canManagePhotographerSelection) return null;

  return (
    <Select value={selectedPhotographer} onValueChange={onSelect}>
      <SelectTrigger aria-label="Photographer" className={cn("w-full min-w-0 flex-1", className)}>
        <SelectValue placeholder="Select photographer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Photographers</SelectItem>
        {photographers.map((photographer) => (
          <SelectItem key={photographer.id} value={photographer.id}>
            {photographer.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
