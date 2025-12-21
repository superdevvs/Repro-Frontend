
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';

interface SidebarHeaderProps {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export function SidebarHeader({ isCollapsed, toggleCollapsed }: SidebarHeaderProps) {
  return (
    <div className="flex items-end border-b px-0 relative pb-2">
      <Link
        to="/"
        className={cn(
          "flex items-center",
          isCollapsed ? "w-full justify-center px-0" : "px-3"
        )}
      >
        <div
          className={cn(
            "h-[42px] w-auto",
            isCollapsed ? "h-10" : ""
          )}
        >
          <Logo 
            className={cn(
              "h-[42px] w-auto",
              isCollapsed && "h-10 w-auto"
            )}
            isCollapsed={isCollapsed}
          />
        </div>
      </Link>

      {!isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 bottom-2 h-8 w-8"
          onClick={toggleCollapsed}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
