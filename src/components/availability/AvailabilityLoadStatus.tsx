import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";

interface AvailabilityLoadStatusProps {
  loading: boolean;
  onRetry: () => void;
}

export function AvailabilityLoadStatus({ loading, onRetry }: AvailabilityLoadStatusProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
      {loading ? (
        <><InlineSpinner className="h-5 w-5" />Loading schedule…</>
      ) : (
        <>Unable to load this schedule.<Button variant="outline" onClick={onRetry}>Retry</Button></>
      )}
    </div>
  );
}
