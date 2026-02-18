
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
  TicketIcon
} from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';

interface MenuItemProps {
  to: string;
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const MenuItem = ({ to, icon, label, isActive, onClick }: MenuItemProps) => {
  // Function to render the correct icon based on the string name
  const renderIcon = () => {
    switch (icon) {
      case 'Home':
        return <HomeIcon className="h-5 w-5" />;
      case 'Clipboard':
        return <ClipboardIcon className="h-5 w-5" />;
      case 'History':
        return <HistoryIcon className="h-5 w-5" />;
      case 'MessageSquare':
        return <MessageSquareIcon className="h-5 w-5" />;
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
      default:
        return <HomeIcon className="h-5 w-5" />;
    }
  };

  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-lg border border-background/10 bg-background/60 p-2.5 shadow-lg transition-all duration-200",
        isActive ? "bg-secondary/90 border-primary/30" : "bg-background/60"
      )}
      onClick={onClick}
    >
      <div className="text-primary">
        {renderIcon()}
      </div>
      <span className="text-xs font-medium leading-tight text-center">{label}</span>
    </Link>
  );
};
