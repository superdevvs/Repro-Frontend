
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
}

export function NavLink({ to, icon, label, isCollapsed, isActive }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative overflow-hidden',
        isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/50',
        isCollapsed && 'justify-center p-2'
      )}
    >
      {/* Animated background for active state - slides left to right */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 bg-secondary/80 rounded-md"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-3">
        {icon}
        {!isCollapsed && <span>{label}</span>}
      </span>
    </Link>
  );
}
