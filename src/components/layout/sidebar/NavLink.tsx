
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
}: NavLinkProps) {
  const defaultActiveIconClassName = '[&_svg]:text-sidebar-accent-foreground dark:[&_svg]:text-sidebar-primary-foreground';
  const collapsedActiveIconClassName = '[&_svg]:text-sidebar-primary dark:[&_svg]:text-sidebar-primary-foreground';

  return (
    <Link
      to={to}
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
        {!isCollapsed && <span>{label}</span>}
      </span>
    </Link>
  );
}
