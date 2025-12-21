import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export interface AutoExpandingTab {
  value: string
  icon: React.ElementType
  label: string
  badge?: number | string
  disabled?: boolean
}

interface AutoExpandingTabsListProps {
  tabs: AutoExpandingTab[]
  value: string
  className?: string
  variant?: 'default' | 'compact'
}

export function AutoExpandingTabsList({
  tabs,
  value,
  className,
  variant = 'default',
}: AutoExpandingTabsListProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]", className)}>
      <TabsPrimitive.List className="flex gap-2">
        {tabs.map((tab) => {
          const isActive = value === tab.value
          const Icon = tab.icon

          return (
            <TabsPrimitive.Trigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              className={cn(
                "relative flex items-center justify-center",
                "rounded-full",
                "transition-all duration-300 ease-in-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                variant === 'compact' ? "h-9" : "h-10",
                isActive
                  ? "bg-primary text-primary-foreground px-4"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              style={{
                width: isActive ? 'auto' : variant === 'compact' ? '2.25rem' : '2.5rem',
                minWidth: isActive ? undefined : variant === 'compact' ? '2.25rem' : '2.5rem',
              }}
            >
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Icon className={cn(
                  "flex-shrink-0",
                  variant === 'compact' ? "h-4 w-4" : "h-4 w-4"
                )} />
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden text-sm font-medium"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {tab.badge && isActive && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "flex items-center justify-center",
                      "rounded-full",
                      "text-xs font-semibold",
                      variant === 'compact' ? "h-4 min-w-[1rem] px-1" : "h-5 min-w-[1.25rem] px-1.5",
                      "bg-primary-foreground/20 text-primary-foreground"
                    )}
                  >
                    {tab.badge}
                  </motion.span>
                )}
              </div>
            </TabsPrimitive.Trigger>
          )
        })}
      </TabsPrimitive.List>
    </div>
  )
}
