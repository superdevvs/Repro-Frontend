
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  MoreVertical,
  Check,
  X,
  Clock,
  ChevronRight
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/components/auth/AuthProvider';

export type IntegrationStatus = 'connected' | 'not_connected' | 'coming_soon';

interface IntegrationCardProps {
  title: string;
  description?: string;
  status: IntegrationStatus;
  icon: React.ReactNode;
  toggleOption?: {
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
  };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfigure?: () => void;
}

export function IntegrationCard({
  title,
  description,
  status,
  icon,
  toggleOption,
  onConnect,
  onDisconnect,
  onConfigure
}: IntegrationCardProps) {
  const { role } = useAuth();
  const isSuperAdmin = role === 'superadmin';

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs line-clamp-2">{description}</CardDescription>
            )}
          </div>
        </div>
        
        {isSuperAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {status === 'connected' && onDisconnect && (
                <DropdownMenuItem onClick={onDisconnect}>
                  Disconnect
                </DropdownMenuItem>
              )}
              
              {status === 'connected' && onConfigure && (
                <DropdownMenuItem onClick={onConfigure}>
                  Configure
                </DropdownMenuItem>
              )}
              
              {status === 'not_connected' && onConnect && (
                <DropdownMenuItem onClick={onConnect}>
                  Connect
                </DropdownMenuItem>
              )}
              
              {status === 'coming_soon' && (
                <DropdownMenuItem disabled>
                  Coming Soon
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      
      <CardContent className="p-4 pt-0 mt-auto">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={status} />
          
          {toggleOption && status === 'connected' && isSuperAdmin && (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground">{toggleOption.label}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle {toggleOption.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Switch
                checked={toggleOption.enabled}
                onCheckedChange={toggleOption.onChange}
              />
            </div>
          )}
          
          {status === 'not_connected' && onConnect && isSuperAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onConnect}
            >
              Connect <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === 'connected') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
        <Check className="h-3 w-3" />
        Connected
      </Badge>
    );
  }
  
  if (status === 'not_connected') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
        <X className="h-3 w-3" />
        Not Connected
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
      <Clock className="h-3 w-3" />
      Coming Soon
    </Badge>
  );
}
