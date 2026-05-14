
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
  Link2,
  Plus
} from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';

interface MobileBottomNavProps {
  toggleMenu: () => void;
}

export const MobileBottomNav = ({ toggleMenu }: MobileBottomNavProps) => {
  const { filteredItems } = useMobileMenu();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';

  const dashboardItem = filteredItems.find((item) => item.to === '/dashboard');
  const shootsItem = filteredItems.find((item) => item.to === '/shoot-history');
  const bookItem = filteredItems.find((item) => item.to === '/book-shoot');
  const availabilityItem = filteredItems.find((item) => item.to === '/availability');
  const centerItem = bookItem
    ? {
        ...bookItem,
        label: 'New Shoot',
      }
    : null;
  // Roles without "Book Shoot" (photographers, sales reps, clients) get a
  // clean 4-slot bar: Dashboard | Shoots | Availability | Menu — the menu
  // sits at the end as the prominent action so the bar never has an empty
  // middle. Roles with Book Shoot keep the 5-slot layout with center pill +
  // trailing "More" toggle.
  const hasBookShoot = Boolean(centerItem);
  const navItems = hasBookShoot
    ? [dashboardItem, shootsItem, centerItem, availabilityItem]
    : [dashboardItem, shootsItem, availabilityItem];

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
      case 'Link2':
        return <Link2 className={iconClass} />;
      case 'Robbie':
        return <ReproAiIcon className={iconClass} useSolid />;
      default:
        return <HomeIcon className={iconClass} />;
    }
  };

  return (
    <motion.div 
      className={cn(
        "fixed left-0 right-0 -bottom-[2px] z-50 px-1 pt-1",
        isLightMode 
          ? "bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-sm"
          : "bg-background/80 backdrop-blur-xl border-t border-white/10 shadow-lg"
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <nav
        className={cn(
          'grid items-end max-w-md mx-auto',
          hasBookShoot ? 'grid-cols-5' : 'grid-cols-4'
        )}
      >
        {navItems.map((item, index) => {
          if (!item) {
            return <div key={`empty-${index}`} />;
          }

          // The center pill (only present when Book Shoot is available) sits at
          // index 2 and is rendered as the prominent gradient circle.
          const isCenter = hasBookShoot && index === 2;

          return (
            <Link
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-end gap-1 rounded-xl px-1 py-0.5 text-xs transition-colors",
                item.isActive
                  ? "text-primary"
                  : isLightMode
                  ? "text-gray-600 hover:text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              {item.isActive && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-3 h-0.5 bg-[linear-gradient(90deg,hsl(var(--primary)/0)_0%,hsl(var(--primary)/0.95)_18%,hsl(var(--primary)/0.95)_82%,hsl(var(--primary)/0)_100%)] shadow-[0_0_10px_hsl(var(--primary)/0.45)]",
                    isCenter ? "bottom-[-5px]" : "top-[-4px]"
                  )}
                />
              )}
              {isCenter ? (
                <span className="relative -mt-4 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.95)_0%,hsl(var(--primary)/0.78)_52%,hsl(var(--accent)/0.9)_100%)] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20 backdrop-blur">
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_10%,hsl(var(--primary-foreground)/0.24),hsl(var(--primary-foreground)/0)_58%)]" />
                  <Plus className="relative z-10 h-5 w-5" aria-hidden="true" />
                </span>
              ) : (
                <span className="relative z-10">{renderIcon(item.icon, item.isActive)}</span>
              )}
              <span className="relative z-10 text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {hasBookShoot ? (
          // Roles with Book Shoot keep the simple trailing "More" toggle since
          // the center already has a prominent action.
          <button
            onClick={toggleMenu}
            className={cn(
              "flex flex-col items-center justify-end gap-1 rounded-xl px-1 py-0.5 text-xs transition-colors",
              isLightMode
                ? "text-gray-600 hover:text-primary"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid h-5 w-5 grid-cols-2 place-items-center gap-1',
                isLightMode ? 'text-gray-600' : 'text-muted-foreground'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-[3px] bg-current" />
              <span className="h-1.5 w-1.5 rounded-[3px] bg-current" />
              <span className="h-1.5 w-1.5 rounded-[3px] bg-current" />
              <span className="h-1.5 w-1.5 rounded-[3px] bg-current" />
            </span>
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        ) : (
          // Roles without Book Shoot get a prominent circular menu button at
          // the end of the bar. The button sits inline within the footer (no
          // negative margin) so it stays visible inside the bar.
          <button
            type="button"
            onClick={toggleMenu}
            className={cn(
              'flex h-full items-center justify-center rounded-xl px-1 py-0.5 transition-colors',
              isLightMode
                ? 'text-gray-600 hover:text-primary'
                : 'text-muted-foreground hover:text-primary'
            )}
            aria-label="Open menu"
          >
            <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-[linear-gradient(135deg,hsl(var(--primary)/0.96)_0%,hsl(var(--primary)/0.8)_55%,hsl(var(--accent)/0.92)_100%)] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20 backdrop-blur">
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_10%,hsl(var(--primary-foreground)/0.22),hsl(var(--primary-foreground)/0)_58%)]" />
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 z-10 h-[2.125rem] w-[2.125rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35 ring-1 ring-primary-foreground/30"
              />
              <span aria-hidden className="absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-1">
                <span className="h-1.5 w-1.5 rounded-[3px] bg-primary-foreground/90" />
                <span className="h-1.5 w-1.5 rounded-[3px] bg-primary-foreground/80" />
                <span className="h-1.5 w-1.5 rounded-[3px] bg-primary-foreground/70" />
                <span className="h-1.5 w-1.5 rounded-[3px] bg-primary-foreground/60" />
              </span>
            </span>
          </button>
        )}
      </nav>
    </motion.div>
  );
};
