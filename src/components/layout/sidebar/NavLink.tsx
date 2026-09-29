
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatBadgeCount } from '@/utils/formatBadgeCount';
import { motion } from 'framer-motion';

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isActive: boolean;
  onActivePreview?: (element: HTMLElement) => void;
  iconClassName?: string;
  activeIconClassName?: string;
  animateIconOnActive?: boolean;
  /** Unread/attention count — same style as the notification bell (999+ ceiling). */
  badge?: number | null;
}

export function NavLink({
  to,
  icon,
  label,
  isCollapsed,
  isActive,
  onActivePreview,
  iconClassName,
  activeIconClassName,
  animateIconOnActive = false,
  badge,
}: NavLinkProps) {
  const defaultActiveIconClassName = '[&_svg]:text-sidebar-accent-foreground dark:[&_svg]:text-sidebar-primary-foreground';
  const collapsedActiveIconClassName = '[&_svg]:text-sidebar-primary dark:[&_svg]:text-sidebar-primary-foreground';
  const badgeLabel = formatBadgeCount(badge);

  return (
    <Link
      to={to}
      aria-label={badgeLabel ? `${label}, ${badgeLabel} unread` : label}
      title={isCollapsed ? (badgeLabel ? `${label} (${badgeLabel})` : label) : undefined}
      data-sidebar-active={isActive ? 'true' : undefined}
      onPointerDown={(event) => onActivePreview?.(event.currentTarget)}
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
          'relative z-20 flex items-center gap-3 transition-colors',
          !isActive && iconClassName,
          isActive && (activeIconClassName ?? defaultActiveIconClassName),
          isActive && isCollapsed && (activeIconClassName ?? collapsedActiveIconClassName)
        )}
      >
        <span className="relative flex items-center">
          {animateIconOnActive ? (
            <motion.span
              className="flex items-center"
              animate={isActive ? { scale: [1, 1.13, 1], rotate: [0, -6, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              {icon}
            </motion.span>
          ) : (
            icon
          )}
          {isCollapsed && badgeLabel && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
              {badgeLabel}
            </span>
          )}
        </span>
        {!isCollapsed && <span>{label}</span>}
      </span>
      {!isCollapsed && badgeLabel && (
        <span className="relative z-20 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badgeLabel}
        </span>
      )}
    </Link>
  );
}
