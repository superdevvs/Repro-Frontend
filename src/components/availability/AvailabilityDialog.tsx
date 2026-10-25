import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import "./availabilityPanels.css";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

/** One accessible surface for Availability: a phone sheet and a desktop drawer. */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, children, onCloseAutoFocus, onOpenAutoFocus, ...props }, ref) => {
  const opener = React.useRef<HTMLElement | null>(null);
  return (
  <Primitive.Portal>
    <Primitive.Overlay className="availability-panel-overlay" />
    <Primitive.Content
      {...props}
      ref={ref}
      className={cn("availability-panel", className)}
      data-availability-panel=""
      onOpenAutoFocus={event => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        const panels = document.querySelectorAll<HTMLElement>('[data-availability-panel][data-state="open"]');
        const activePanel = panels[panels.length - 1];
        if (activePanel) {
          if (!activePanel.contains(document.activeElement)) activePanel.focus();
        } else if (opener.current?.isConnected && opener.current !== document.body && !opener.current.closest('[data-state="closed"]')) {
          opener.current.focus();
        } else {
          document.querySelector<HTMLElement>('[aria-label="Calendar tools"]')?.focus();
        }
        onCloseAutoFocus?.(event);
      }}
    >
      <div className="availability-panel-handle" aria-hidden="true" />
      <div className="availability-panel-scroll">{children}</div>
      <Primitive.Close className="availability-panel-close" aria-label="Close">
        <X size={20} aria-hidden="true" />
      </Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>
  );
});
DialogContent.displayName = "AvailabilityDialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("availability-panel-header", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("availability-panel-footer", className)} {...props} />;
}
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof Primitive.Title>,
  React.ComponentPropsWithoutRef<typeof Primitive.Title>
>(({ className, ...props }, ref) => (
  <Primitive.Title ref={ref} className={cn("availability-panel-title", className)} {...props} />
));
DialogTitle.displayName = "AvailabilityDialogTitle";
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof Primitive.Description>,
  React.ComponentPropsWithoutRef<typeof Primitive.Description>
>(({ className, ...props }, ref) => (
  <Primitive.Description ref={ref} className={cn("availability-panel-description", className)} {...props} />
));
DialogDescription.displayName = "AvailabilityDialogDescription";

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <AlertPrimitive.Portal>
    <AlertPrimitive.Overlay className="availability-panel-overlay" />
    <AlertPrimitive.Content ref={ref} className={cn("availability-panel", className)} data-availability-panel="" {...props}>
      <div className="availability-panel-handle" aria-hidden="true" />
      <div className="availability-panel-scroll">{children}</div>
    </AlertPrimitive.Content>
  </AlertPrimitive.Portal>
));
AlertDialogContent.displayName = "AvailabilityAlertDialogContent";
