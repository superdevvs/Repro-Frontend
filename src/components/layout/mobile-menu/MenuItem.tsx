
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatBadgeCount } from '@/utils/formatBadgeCount';
import { 
  HomeIcon, 
  ClipboardIcon, 
  HistoryIcon, 
  MessageSquareIcon, 
  UserIcon, 
  BuildingIcon, 
  FileTextIcon, 
  CalendarIcon, 
  SettingsIcon,
  LogOutIcon,
  BarChart3Icon,
  TicketIcon,
  ExternalLinkIcon,
  Sparkles,
  Mail,
  Phone,
} from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';

interface MenuItemProps {
  to: string;
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  external?: boolean;
  badge?: number;
}

export const MenuItem = ({ to, icon, label, isActive, onClick, external = false, badge }: MenuItemProps) => {
  const badgeLabel = formatBadgeCount(badge);
  const accessibleLabel = badgeLabel ? `${label}, ${badgeLabel} unread` : label;
  // Function to render the correct icon based on the string name
  const renderIcon = () => {
    switch (icon) {
      case 'Sparkles':
        return <Sparkles className="h-5 w-5" />;
      case 'Home':
        return <HomeIcon className="h-5 w-5" />;
      case 'Clipboard':
        return <ClipboardIcon className="h-5 w-5" />;
      case 'History':
        return <HistoryIcon className="h-5 w-5" />;
      case 'MessageSquare':
        return <MessageSquareIcon className="h-5 w-5" />;
      case 'Mail':
        return <Mail className="h-5 w-5" />;
      case 'Phone':
        return <Phone className="h-5 w-5" />;
      case 'Robbie':
        return <ReproAiIcon className="h-5 w-5" useSolid />;
      case 'User':
        return <UserIcon className="h-5 w-5" />;
      case 'Building':
        return <BuildingIcon className="h-5 w-5" />;
      case 'FileText':
        return <FileTextIcon className="h-5 w-5" />;
      case 'Calendar':
        return <CalendarIcon className="h-5 w-5" />;
      case 'Settings':
        return <SettingsIcon className="h-5 w-5" />;
      case 'LogOut':
        return <LogOutIcon className="h-5 w-5" />;
      case 'BarChart3':
        return <BarChart3Icon className="h-5 w-5" />;
      case 'Ticket':
        return <TicketIcon className="h-5 w-5" />;
      case 'ExternalLink':
        return <ExternalLinkIcon className="h-5 w-5" />;
      default:
        return <HomeIcon className="h-5 w-5" />;
    }
  };

  const className = cn(
    "relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-lg border border-background/10 bg-background/60 p-2.5 shadow-lg transition-all duration-200",
    isActive ? "bg-secondary/90 border-primary/30" : "bg-background/60"
  );
  const content = (
    <>
      {badgeLabel && (
        <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badgeLabel}
        </span>
      )}
      <div className="text-primary">
        {renderIcon()}
      </div>
      <span className="text-xs font-medium leading-tight text-center">{label}</span>
    </>
  );

  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick} aria-label={accessibleLabel}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className={className} onClick={onClick} aria-label={accessibleLabel} aria-current={isActive ? 'page' : undefined}>
      {content}
    </Link>
  );
};
