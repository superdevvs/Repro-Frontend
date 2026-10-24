import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { getInitials } from "@/lib/utils";
import type { Photographer } from "@/types/availability";

export function AvailabilityAvatarStack({
  photographers,
  limit = 3,
}: {
  photographers: Photographer[];
  limit?: number;
}) {
  return (
    <span
      className="availability-avatar-stack"
      role="img"
      aria-label={photographers.map((p) => p.name).join(", ")}
    >
      {photographers.slice(0, limit).map((p) => (
        <Avatar key={p.id} className="availability-portrait" aria-hidden="true">
          <AvatarImage
            src={getAvatarUrl(p.avatar, "photographer", undefined, p.id)}
            alt=""
          />
          <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
        </Avatar>
      ))}
      {photographers.length > limit && (
        <span className="availability-avatar-more" aria-hidden="true">
          +{photographers.length - limit}
        </span>
      )}
    </span>
  );
}
