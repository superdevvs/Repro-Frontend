import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DialogContent, DialogFooter, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** One presentation for Availability tools: a phone sheet, tablet drawer, or desktop dialog. */
export const AvailabilityPanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, className, ...props }, ref) => {
  const compact = useMediaQuery("(max-width: 1279px)");
  if (!compact) return <DialogContent ref={ref} className={className} {...props}>{children}</DialogContent>;
  const [heading, ...content] = React.Children.toArray(children);

  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        data-availability-panel="true"
        className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col overflow-hidden rounded-t-[28px] border border-border/70 bg-background shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom md:inset-y-3 md:left-auto md:right-3 md:w-[480px] md:max-w-[calc(100vw-1.5rem)] md:max-h-[calc(100dvh-1.5rem)] md:rounded-[24px] md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right"
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mb-1 mt-2.5 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" />
        <div className="shrink-0 px-4 pb-4 pr-16 pt-5 md:pl-5 md:pt-6 [&>div]:text-left [&_h2]:text-xl [&_h2]:leading-7">{heading}</div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">
          {content}
        </div>
        <DialogPrimitive.Close className="absolute right-3 top-5 z-[80] flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:top-4">
          <X className="h-[18px] w-[18px]" /><span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
AvailabilityPanelContent.displayName = "AvailabilityPanelContent";

export function AvailabilityPanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const compact = useMediaQuery("(max-width: 1279px)");
  return <DialogFooter className={cn(compact && "sticky -bottom-4 z-10 -mx-4 mt-2 flex-row gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur [&>button]:min-h-11 [&>button]:flex-1 [&>button]:rounded-xl", className)} {...props} />;
}
