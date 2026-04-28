import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubItem {
  to: string;
  label: string;
}

interface ExpandableNavLinkProps {
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  defaultTo: string; // Where to go when clicking the main item
  subItems: SubItem[];
  onActivePreview?: (element: HTMLElement) => void;
}

export function ExpandableNavLink({ 
  icon, 
  label, 
  isCollapsed, 
  defaultTo,
  subItems,
  onActivePreview,
}: ExpandableNavLinkProps) {
  const { pathname } = useLocation();

  // Check if any sub-item is active (must be defined before useState uses it)
  const isAnySubItemActive = subItems.some(item => pathname.startsWith(item.to));
  // Check if we're on the default route or any route that starts with the base path (e.g., /messaging)
  const basePath = defaultTo.split('/').slice(0, 2).join('/'); // e.g., '/messaging' from '/messaging/overview'
  const isOnDefaultRoute = pathname === defaultTo || (pathname.startsWith(basePath + '/') && pathname !== basePath);
  const isActive = pathname === defaultTo || isAnySubItemActive || isOnDefaultRoute;

  // Initialize expanded state: true if any sub-item is active OR if we're on the default/messaging route
  const [isExpanded, setIsExpanded] = useState(() => isAnySubItemActive || isOnDefaultRoute);

  // Auto-expand if any sub-item becomes active via routing OR if we're on the default route
  useEffect(() => {
    if (isAnySubItemActive || isOnDefaultRoute) {
      setIsExpanded(true);
    }
  }, [isAnySubItemActive, isOnDefaultRoute, pathname]);

  const handleMainClick = (e: React.MouseEvent) => {
    // Always expand when clicking the main link (if not collapsed)
    // This ensures the menu expands immediately on click, even before navigation
    if (!isCollapsed) {
      setIsExpanded(true);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div>
      {/* Main Item */}
      <Link
        to={defaultTo}
        data-sidebar-active={isActive ? 'true' : undefined}
        onPointerDown={(event) => onActivePreview?.(event.currentTarget)}
        onClick={handleMainClick}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200',
          isActive
            ? 'font-medium text-sidebar-accent-foreground dark:text-sidebar-primary-foreground'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
          isCollapsed && 'justify-center p-2'
        )}
      >
        <span
          className={cn(
            'relative z-20 flex items-center',
            isActive && '[&_svg]:text-sidebar-accent-foreground dark:[&_svg]:text-sidebar-primary-foreground',
            isActive && isCollapsed && '[&_svg]:text-sidebar-primary dark:[&_svg]:text-sidebar-primary-foreground'
          )}
        >
          {icon}
        </span>
        {!isCollapsed && (
          <>
            <span className="relative z-20 flex-1">{label}</span>
            <button
              type="button"
              onClick={handleChevronClick}
              className={cn(
                'relative z-20 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-primary',
                isActive ? 'text-sidebar-accent-foreground hover:bg-sidebar-primary/10 dark:text-sidebar-primary-foreground dark:hover:bg-white/10' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', !isExpanded && '-rotate-90')} />
            </button>
          </>
        )}
      </Link>

      {/* Sub Items */}
      {!isCollapsed && isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-muted pl-3">
          {subItems.map((subItem) => {
            const isSubItemActive = pathname === subItem.to || pathname.startsWith(subItem.to + '/');
            return (
              <Link
                key={subItem.to}
                to={subItem.to}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  isSubItemActive 
                    ? 'bg-sidebar-primary/10 font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-border dark:text-sidebar-primary-foreground dark:ring-white/5' 
                    : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                )}
              >
                {subItem.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
