
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Mail, Phone, User, MapPin, Shield } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AccountBoxProps {
  account: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    avatar?: string;
    location?: string;
    joinDate?: string;
    status: 'active' | 'inactive' | 'pending';
  };
  onSelect?: (account: any) => void;
  isSelected?: boolean;
}

export function AccountBox({ account, onSelect, isSelected = false }: AccountBoxProps) {
  const isMobile = useIsMobile();
  
  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'superadmin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'editing_manager': return 'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400';
      case 'client': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'photographer': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'editor': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'salesrep': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700/20 dark:text-gray-400';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-700/20 dark:text-gray-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700/20 dark:text-gray-400';
    }
  };
  
  const handleClick = () => {
    if (onSelect) {
      onSelect(account);
    }
  };
  
  return (
    <Card 
      className={`p-4 transition-all cursor-pointer ${isSelected ? 'ring-2 ring-inset ring-primary' : 'hover:bg-muted/5'}`}
      onClick={handleClick}
    >
      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
        <div className={`${isMobile ? 'flex justify-center' : ''}`}>
          <Avatar className={`${isMobile ? 'h-20 w-20' : 'h-14 w-14'}`}>
            <AvatarImage src={account.avatar} alt={account.name} />
            <AvatarFallback>{account.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        
        <div className={`flex-1 ${isMobile ? 'text-center' : ''}`}>
          <div className={`flex ${isMobile ? 'flex-col items-center' : 'items-start justify-between'} mb-2`}>
            <h3 className="font-semibold text-lg">{account.name}</h3>
            <div className={`flex gap-2 ${isMobile ? 'mt-2' : ''}`}>
              <Badge className={getRoleColor(account.role)}>{account.role}</Badge>
              <Badge className={getStatusColor(account.status)}>
                {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
              </Badge>
            </div>
          </div>
          
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-x-4 gap-y-1'}`}>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate">{account.email}</span>
            </div>
            
            {account.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{account.phone}</span>
              </div>
            )}
            
            {account.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">{account.location}</span>
              </div>
            )}
            
            {account.joinDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Joined {account.joinDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
