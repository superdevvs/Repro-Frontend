import React from 'react';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  badge?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  iconText?: string;
  action?: React.ReactNode;
}

export function PageHeader({ 
  badge, 
  title, 
  description, 
  icon: Icon, 
  iconText,
  action 
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {badge && (
            <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
              {badge}
            </Badge>
          )}
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {description}
          </p>
        </div>
        
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      
      {Icon && iconText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{iconText}</span>
        </div>
      )}
    </div>
  );
}

