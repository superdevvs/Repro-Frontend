
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
  MenuIcon,
  Plus
} from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { buildMobileBottomNavSlots } from './mobileBottomNavSlots';

interface MobileBottomNavProps {
  toggleMenu: () => void;
  onBottomNavHeightChange?: (height: number) => void;
}

export const MobileBottomNav = ({ toggleMenu, onBottomNavHeightChange }: MobileBottomNavProps) => {
  const navRef = React.useRef<HTMLDivElement>(null);
  const { filteredItems, isLoading } = useMobileMenu();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';

  // Nothing to navigate to yet, or at all. Until permissions resolve every item
  // is filtered out, and drawing the bar anyway left three empty slots and a
  // single round menu button floating at the bottom of every role's loading
  // screen. The bar appears only once it has real destinations.
  const isVisible = !isLoading && filteredItems.length > 0;

  React.useLayoutEffect(() => {
    const nav = navRef.current;
    if (!onBottomNavHeightChange) return;
    if (!nav) {
      // Hidden bar occupies no space, so the page loader must not reserve any.
      onBottomNavHeightChange(0);
      return;
    }
    // Include safe-area padding, excluding the 2px below the viewport. offsetHeight
    // stays stable while the bar's entrance transform animates into position.
    const reportHeight = () => onBottomNavHeightChange(Math.max(0, nav.offsetHeight - 2));
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [isVisible, onBottomNavHeightChange]);

  if (!isVisible) {
    return null;
  }

  const navItems = buildMobileBottomNavSlots(filteredItems);
  const hasBookShoot = navItems.some((item) => item.to === '/book-shoot');
  const columnCount = navItems.length + 1;

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
      ref={navRef}
      data-mobile-bottom-nav
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
          columnCount >= 5 ? 'grid-cols-5' : columnCount === 3 ? 'grid-cols-3' : 'grid-cols-4',
        )}
      >
        {navItems.map((item, index) => {
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
          // Roles without Book Shoot get the menu as the prominent action at
          // the end of the bar. Same treatment as the "New Shoot" pill (gradient
          // circle, icon, caption) so it reads as part of the bar rather than a
          // separate floating control; the earlier dark inner disc with four
          // dots read as a shirt button.
          <button
            type="button"
            onClick={toggleMenu}
            className={cn(
              'relative flex flex-col items-center justify-end gap-1 rounded-xl px-1 py-0.5 text-xs transition-colors',
              isLightMode
                ? 'text-gray-600 hover:text-primary'
                : 'text-muted-foreground hover:text-primary'
            )}
            aria-label="Open menu"
          >
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.95)_0%,hsl(var(--primary)/0.78)_52%,hsl(var(--accent)/0.9)_100%)] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20 backdrop-blur">
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_10%,hsl(var(--primary-foreground)/0.24),hsl(var(--primary-foreground)/0)_58%)]" />
              <MenuIcon className="relative z-10 h-5 w-5" aria-hidden="true" />
            </span>
            <span className="relative z-10 text-[10px] font-medium leading-none">Menu</span>
          </button>
        )}
      </nav>
    </motion.div>
  );
};
