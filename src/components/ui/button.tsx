import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/src/lib/utils"

// Pill buttons. Every one answers the finger on press (scale .97) and only colours change on hover.
// `default` is the red "do it" button: one per screen, ideally.
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium outline-none transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-red-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_30px_-10px_rgb(229_15_5/0.7)] hover:bg-red-500",
        destructive:
          "bg-red-600/15 text-red-300 hover:bg-red-600/25",
        outline:
          "border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/[0.06]",
        secondary:
          "bg-white/[0.1] text-white backdrop-blur-md hover:bg-white/[0.16]",
        white:
          "bg-white text-black hover:bg-white/85",
        ghost: "text-white/80 hover:bg-white/[0.08] hover:text-white",
        link: "rounded-md text-red-400 underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
