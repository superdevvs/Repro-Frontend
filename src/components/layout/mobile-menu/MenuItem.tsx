
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
        return <HomeIcon className="h-6 w-6" />;
      case 'Clipboard':
        return <ClipboardIcon className="h-6 w-6" />;
      case 'History':
        return <HistoryIcon className="h-6 w-6" />;
      case 'MessageSquare':
        return <MessageSquareIcon className="h-6 w-6" />;
      case 'Robbie':
        return <ReproAiIcon className="h-6 w-6" />;
      case 'User':
        return <UserIcon className="h-6 w-6" />;
      case 'Building':
        return <BuildingIcon className="h-6 w-6" />;
      case 'FileText':
        return <FileTextIcon className="h-6 w-6" />;
      case 'Calendar':
        return <CalendarIcon className="h-6 w-6" />;
      case 'Settings':
        return <SettingsIcon className="h-6 w-6" />;
      case 'LogOut':
        return <LogOutIcon className="h-6 w-6" />;
      case 'BarChart3':
        return <BarChart3Icon className="h-6 w-6" />;
      case 'Ticket':
        return <TicketIcon className="h-6 w-6" />;
      default:
        return <HomeIcon className="h-6 w-6" />;
    }
  };

  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl backdrop-blur-md bg-background/60 border border-background/10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105",
        isActive ? "bg-secondary/90 border-primary/30" : "bg-background/60"
      )}
      onClick={onClick}
    >
      <div className="text-2xl text-primary">
        {renderIcon()}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
};
