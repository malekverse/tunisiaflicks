"use client"

import { useToast } from "@/src/hooks/use-toast"
import { useDir } from "@/src/components/I18nProvider"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/src/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  // Toasts sit at the end edge, so they are swiped away towards it.
  const swipeDirection = useDir() === "rtl" ? "left" : "right"

  return (
    <ToastProvider swipeDirection={swipeDirection}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
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
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
