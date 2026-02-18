
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown, MessageSquareIcon, Mail, MessageCircle } from 'lucide-react';

interface SubItem {
  to: string;
  label: string;
}

interface ExpandableMenuItemProps {
  to: string;
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  subItems?: SubItem[];
}

export const ExpandableMenuItem = ({ 
  to, 
  icon, 
  label, 
  isActive, 
  onClick,
  subItems = []
}: ExpandableMenuItemProps) => {
  const { pathname } = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if any sub-item is active
  const isAnySubItemActive = subItems.some(item => pathname.startsWith(item.to));
  const basePath = to.split('/').slice(0, 2).join('/');
  const isOnDefaultRoute = pathname === to || (pathname.startsWith(basePath + '/') && pathname !== basePath);
  const shouldBeExpanded = isAnySubItemActive || isOnDefaultRoute;

  // Auto-expand if any sub-item is active
  useEffect(() => {
    if (shouldBeExpanded) {
      setIsExpanded(true);
    }
  }, [shouldBeExpanded]);

  const renderIcon = () => {
    switch (icon) {
      case 'MessageSquare':
        return <MessageSquareIcon className="h-5 w-5" />;
      default:
        return <MessageSquareIcon className="h-5 w-5" />;
    }
  };

  const getSubItemIcon = (subItemLabel: string) => {
    if (subItemLabel.toLowerCase().includes('email')) {
      return <Mail className="h-4 w-4" />;
    }
    if (subItemLabel.toLowerCase().includes('sms')) {
      return <MessageCircle className="h-4 w-4" />;
    }
    return null;
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="col-span-2">
      {/* Main Item */}
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-background/10 bg-background/60 shadow-lg transition-all duration-200",
          isActive ? "bg-secondary/90 border-primary/30" : "bg-background/60"
        )}
      >
        <div className="flex items-center gap-1.5 p-2.5">
          <Link
            to={to}
            onClick={onClick}
            className="flex flex-1 flex-col items-center justify-center gap-1.5"
          >
            <div className="text-primary">
              {renderIcon()}
            </div>
            <span className="text-xs font-medium leading-tight text-center">{label}</span>
          </Link>
          {subItems.length > 0 && (
            <button
              onClick={handleToggle}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/50 flex-shrink-0"
              aria-label="Toggle submenu"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
            </button>
          )}
        </div>

        {/* Sub Items */}
        <AnimatePresence>
          {isExpanded && subItems.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-background/20"
            >
              <div className="space-y-1 p-2">
                {subItems.map((subItem) => {
                  const isSubItemActive = pathname === subItem.to || pathname.startsWith(subItem.to + '/');
                  return (
                    <Link
                      key={subItem.to}
                      to={subItem.to}
                      onClick={onClick}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        isSubItemActive
                          ? "bg-secondary/60 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      )}
                    >
                      {getSubItemIcon(subItem.label)}
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


