"use client"
// Toasts, rendered by Sonner (see components/ui/toaster.tsx). The call shape is the same as the
// old shadcn toast, so every `toast({ title, description, variant })` in the app keeps working.
import type { ReactNode } from 'react'
import { toast as sonner } from 'sonner'

type ToastOptions = {
  title?: ReactNode
  description?: ReactNode
  /** "destructive" shows the error style. */
  variant?: 'default' | 'destructive'
  duration?: number
  /** A button in the toast (e.g. "Sign in"). */
  action?: { label: string, onClick: () => void }
}

export function toast({ title, description, variant, duration, action }: ToastOptions) {
  const options = { description, duration, action }
  const id = variant === 'destructive' ? sonner.error(title, options) : sonner(title, options)
  return { id, dismiss: () => sonner.dismiss(id) }
}

export function useToast() {
  return { toast, dismiss: (id?: string | number) => sonner.dismiss(id) }
}
