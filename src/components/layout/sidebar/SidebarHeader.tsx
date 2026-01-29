
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';

interface SidebarHeaderProps {
  isCollapsed: boolean;
}

export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
  return (
    <div className="flex items-end border-b px-0 relative pb-4">
      <Link
        to="/"
        className={cn(
          "flex items-center",
          isCollapsed ? "w-full justify-center px-0" : "px-3"
        )}
      >
        <div
          className={cn(
            "h-[30px] w-auto",
            isCollapsed ? "h-7" : ""
          )}
        >
          <Logo 
            className={cn(
              "h-[30px] w-auto",
              isCollapsed && "h-7 w-auto"
            )}
            isCollapsed={isCollapsed}
          />
        </div>
      </Link>
    </div>
  );
}
