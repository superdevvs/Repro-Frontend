import { toast as sonnerToast } from "sonner"

type SonnerToast = typeof sonnerToast
type ToastMessage = Parameters<SonnerToast>[0]
type ToastOptions = Parameters<SonnerToast>[1]
type ToastMethod = SonnerToast["success"]
type ToastMethodMessage = Parameters<ToastMethod>[0]
type ToastMethodOptions = Parameters<ToastMethod>[1]

const withPosition = <TOptions extends { position?: string } | undefined>(
  options: TOptions,
  position: NonNullable<TOptions>["position"],
): TOptions => ({
  ...options,
  position: options?.position ?? position,
} as TOptions)

export const toast = Object.assign(
  ((message: ToastMessage, options?: ToastOptions) =>
    sonnerToast(message, withPosition(options, "bottom-right"))) as SonnerToast,
  sonnerToast,
  {
    success: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.success(message, withPosition(options, "bottom-right"))) as SonnerToast["success"],
    info: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.info(message, withPosition(options, "bottom-right"))) as SonnerToast["info"],
    warning: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.warning(message, withPosition(options, "bottom-right"))) as SonnerToast["warning"],
    message: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.message(message, withPosition(options, "bottom-right"))) as SonnerToast["message"],
    loading: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.loading(message, withPosition(options, "bottom-right"))) as SonnerToast["loading"],
    error: ((message: ToastMethodMessage, options?: ToastMethodOptions) =>
      sonnerToast.error(message, withPosition(options, "top-right"))) as SonnerToast["error"],
  },
)
