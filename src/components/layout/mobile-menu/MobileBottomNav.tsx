
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useMobileMenu } from './useMobileMenu';
import { 
  HomeIcon, 
  ClipboardIcon, 
  CalendarIcon, 
  UserIcon, 
  BuildingIcon, 
  BarChart3Icon, 
  SettingsIcon,
  TicketIcon,
  MessageSquare,
  MoreHorizontal
} from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';

interface MobileBottomNavProps {
  toggleMenu: () => void;
}

export const MobileBottomNav = ({ toggleMenu }: MobileBottomNavProps) => {
  const { filteredItems } = useMobileMenu();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';

  // Only show the first 5 items in the bottom nav
  const navItems = filteredItems.slice(0, 5);

  // Function to render the correct icon based on the string name
  const renderIcon = (iconName: string, isActive: boolean) => {
    const iconClass = cn(
      "h-5 w-5 mb-1",
      isActive ? "text-primary" : isLightMode ? "text-gray-600" : "text-muted-foreground"
    );

    switch (iconName) {
      case 'Home':
        return <HomeIcon className={iconClass} />;
      case 'Clipboard':
        return <ClipboardIcon className={iconClass} />;
      case 'Calendar':
        return <CalendarIcon className={iconClass} />;
      case 'User':
        return <UserIcon className={iconClass} />;
      case 'Building':
        return <BuildingIcon className={iconClass} />;
      case 'FileText':
        return <BarChart3Icon className={iconClass} />;
      case 'Settings':
        return <SettingsIcon className={iconClass} />;
      case 'Ticket':
        return <TicketIcon className={iconClass} />;
      case 'MessageSquare':
        return <MessageSquare className={iconClass} />;
      case 'Robbie':
        return <ReproAiIcon className={iconClass} useSolid />;
      default:
        return <HomeIcon className={iconClass} />;
    }
  };

  return (
    <motion.div 
      className={cn(
        "fixed left-0 right-0 -bottom-[2px] z-50 px-1 pt-2",
        isLightMode 
          ? "bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-sm"
          : "bg-background/50 backdrop-blur-xl border-t border-white/10 shadow-lg"
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <nav className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors",
              "text-xs",
              item.isActive
                ? isLightMode
                  ? "text-primary bg-primary/5"
                  : "text-primary bg-primary/20"
                : isLightMode
                ? "text-gray-600 hover:text-primary hover:bg-primary/5"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            )}
          >
            {renderIcon(item.icon, item.isActive)}
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}

        {/* More button to open full menu */}
        <button
          onClick={toggleMenu}
          className={cn(
            "flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors",
            "text-xs",
            isLightMode
              ? "text-gray-600 hover:text-primary hover:bg-primary/5"
              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          )}
        >
          <MoreHorizontal className={cn(
            "h-5 w-5 mb-1",
            isLightMode ? "text-gray-600" : "text-muted-foreground"
          )} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </motion.div>
  );
};
