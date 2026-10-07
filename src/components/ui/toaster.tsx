"use client"

import { Toaster as Sonner } from "sonner"
import { useDir } from "@/src/components/I18nProvider"

/**
 * Glass toasts at the bottom centre: above the tab bar on phones, low on desktop. Sonner pauses
 * them while the tab is hidden and lets them be swiped away.
 */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      dir={useDir()}
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      visibleToasts={3}
      duration={3500}
      toastOptions={{
        classNames: {
          toast: 'glass-strong !rounded-[18px] !border-white/10 !text-white !shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)] !font-sans',
          title: '!text-[14px] !font-semibold',
          description: '!text-[13px] !text-white/65',
          error: '[&_[data-icon]]:!text-red-500',
        },
      }}
    />
  )
}
