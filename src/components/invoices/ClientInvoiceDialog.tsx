import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ClientInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function ClientInvoiceDialog({ open, onOpenChange, title, description, children, headerAction, className, bodyClassName }: ClientInvoiceDialogProps) {
  const { role } = useAuth();
  const isMobile = useIsMobile();

  if (role === 'client' && isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="mt-0 max-h-[92dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)]">
          <DrawerHeader className="shrink-0 border-b px-4 pb-4 pt-2 text-left">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <DrawerTitle className="min-w-0 text-lg leading-6">{title}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label="Close invoice panel">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            <DrawerDescription className="text-xs leading-5">{description}</DrawerDescription>
            {headerAction ? <div className="pt-2">{headerAction}</div> : null}
          </DrawerHeader>
          <div data-vaul-no-drag className={cn('min-h-0 overflow-y-auto overscroll-contain px-4 py-4', bodyClassName)}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[90vh] flex-col overflow-hidden p-0', className)}>
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
            {headerAction}
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={cn('min-h-0 overflow-y-auto px-6 py-4', bodyClassName)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
