import * as React from "react"
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
  desktopExpanded?: boolean
}

export function AutoExpandingTabsList({
  tabs,
  value,
  className,
  variant = 'default',
  desktopExpanded = false,
}: AutoExpandingTabsListProps) {
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null)

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]", className)}>
      <TabsPrimitive.List className="flex gap-2">
        {tabs.map((tab) => {
          const isActive = value === tab.value
          const isHovered = hoveredTab === tab.value
          const shouldExpandOnMobile = isActive || isHovered
          const Icon = tab.icon

          return (
            <div
              key={tab.value}
              className="relative"
              onMouseEnter={() => !tab.disabled && setHoveredTab(tab.value)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {/* Invisible extended hitbox - only when hovered to prevent wiggle during expansion */}
              {shouldExpandOnMobile && (
                <div 
                  className="absolute top-0 bottom-0 left-0"
                  style={{
                    right: '-50px',
                    zIndex: 0,
                  }}
                  onMouseEnter={() => !tab.disabled && setHoveredTab(tab.value)}
                />
              )}
              <TabsPrimitive.Trigger
                value={tab.value}
                disabled={tab.disabled}
                className={cn(
                  "relative flex items-center justify-center z-10",
                  "rounded-full",
                  "transition-all duration-150 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  variant === 'compact' ? "h-9" : "h-10",
                  // When collapsed: perfect circle (w = h), when expanded: pill with padding and gap
                  shouldExpandOnMobile
                    ? "px-4 gap-2" 
                    : variant === 'compact' ? "w-9" : "w-10",
                  desktopExpanded && "sm:w-auto sm:px-4 sm:gap-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isHovered
                    ? "bg-muted/80 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="flex-shrink-0 h-4 w-4" />
                {(shouldExpandOnMobile || desktopExpanded) && (
                  <span
                    className={cn(
                      "text-sm font-medium whitespace-nowrap",
                      shouldExpandOnMobile ? "inline" : "hidden",
                      desktopExpanded && "sm:inline"
                    )}
                  >
                    {tab.label}
                  </span>
                )}
                {tab.badge && (shouldExpandOnMobile || desktopExpanded) && (
                  <span
                    className={cn(
                      "flex items-center justify-center",
                      "rounded-full",
                      "text-xs font-semibold",
                      shouldExpandOnMobile ? "inline-flex" : "hidden",
                      desktopExpanded && "sm:inline-flex",
                      variant === 'compact' ? "h-4 min-w-[1rem] px-1" : "h-5 min-w-[1.25rem] px-1.5",
                      isActive 
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-foreground/10 text-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </TabsPrimitive.Trigger>
            </div>
          )
        })}
      </TabsPrimitive.List>
    </div>
  )
}
