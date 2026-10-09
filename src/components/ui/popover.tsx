"use client"
// A small glass panel anchored to what opened it: for panels that hold actions (the desktop inbox,
// a sign-in prompt, a filter). Plain command lists stay dropdown menus (components/ui/dropdown-menu).
//
//   <Popover>
//     <PopoverTrigger asChild><Button>…</Button></PopoverTrigger>
//     <PopoverContent align="end" className="w-[360px] p-0">…</PopoverContent>
//   </Popover>
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { EASE_OUT, tween } from '@/src/lib/motion'

// The content animates out after the root says "closed", so it needs to know the open state itself.
const OpenContext = React.createContext(false)

/** Same API as Radix Popover.Root (controlled with open/onOpenChange, or uncontrolled). */
function Popover({ open: openProp, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolledOpen
  const handleOpenChange = React.useCallback((next: boolean) => {
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }, [controlled, onOpenChange])

  return (
    <OpenContext.Provider value={open}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props} />
    </OpenContext.Provider>
  )
}

const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverClose = PopoverPrimitive.Close

/**
 * The panel: heavy glass, a 22px radius, 8px from its trigger and 12px from the screen edges. It
 * grows out of its trigger (scale .97 to 1 with a fade, the origin on the trigger's side) and leaves
 * faster than it came; with reduced motion it only fades. Default size w-72 and p-4; override both
 * with className.
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 8, collisionPadding = 12, align = 'center', children, style, ...props }, ref) => {
  const open = React.useContext(OpenContext)
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            ref={ref}
            forceMount
            asChild
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            align={align}
            {...props}
          >
            <m.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1, transition: tween.fast }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: EASE_OUT } }}
              style={{ ...style, transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
              className={cn(
                // The ring draws the edge (glass-strong's own border would double it).
                'glass-strong z-50 w-72 max-w-[calc(100vw-24px)] rounded-[22px] border-0 p-4 text-white shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)] outline-none ring-1 ring-white/[0.08]',
                className,
              )}
            >
              {children}
            </m.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent, PopoverClose }
