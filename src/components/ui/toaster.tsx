import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const topToasts = toasts.filter((toast) => toast.variant === "destructive")
  const bottomToasts = toasts.filter((toast) => toast.variant !== "destructive")

  const renderToast = (placement: "top" | "bottom") =>
    function RenderToast({ id, title, description, action, ...props }: (typeof toasts)[number]) {
      return (
        <Toast key={id} placement={placement} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && (
              <ToastDescription>{description}</ToastDescription>
            )}
          </div>
          {action}
          <ToastClose />
        </Toast>
      )
    }

  return (
    <>
      <ToastProvider>
        {topToasts.map(renderToast("top"))}
        <ToastViewport position="top-right" />
      </ToastProvider>
      <ToastProvider>
        {bottomToasts.map(renderToast("bottom"))}
        <ToastViewport position="bottom-right" />
      </ToastProvider>
    </>
  )
}
