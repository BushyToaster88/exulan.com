"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

type ToggleGroupContextValue = VariantProps<typeof toggleVariants>

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: "default",
  variant: "default",
})

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupPrimitive.Props & ToggleGroupContextValue) {
  const contextValue = React.useMemo(
    () => ({ size: size ?? "default", variant: variant ?? "default" }),
    [size, variant]
  )

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={contextValue.variant}
      data-size={contextValue.size}
      className={cn("flex w-fit flex-row items-center gap-1 rounded-md", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={contextValue}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & ToggleGroupContextValue) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={variant ?? context.variant}
      data-size={size ?? context.size}
      className={cn(
        toggleVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
        }),
        "shrink-0 aria-pressed:border-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
