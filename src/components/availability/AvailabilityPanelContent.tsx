import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DialogContent, DialogFooter, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import "./availabilityPanels.css";

/** Availability Flow layout, with the dashboard's current theme colors. */
export const AvailabilityPanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, className, ...props }, ref) => {
  const compact = useMediaQuery("(max-width: 1279px)");
  if (!compact) return <DialogContent ref={ref} className={cn("availability-flow", className)} {...props}>{children}</DialogContent>;
  const [heading, ...content] = React.Children.toArray(children);

  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        data-availability-panel="true"
        className="availability-panel"
        {...props}
      >
        <div aria-hidden="true" className="availability-panel-handle" />
        <div className="shrink-0 px-5 pb-4 pr-16 pt-5 [&>div]:text-left [&_h2]:text-[22px] [&_h2]:leading-7">{heading}</div>
        <div className="availability-panel-body">
          {content}
        </div>
        <DialogPrimitive.Close className="availability-panel-close z-[80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-[18px] w-[18px]" /><span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
AvailabilityPanelContent.displayName = "AvailabilityPanelContent";

export function AvailabilityPanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const compact = useMediaQuery("(max-width: 1279px)");
  return <DialogFooter className={cn(compact && "availability-panel-footer z-10 border-t [&>button]:min-h-11", className)} {...props} />;
}
