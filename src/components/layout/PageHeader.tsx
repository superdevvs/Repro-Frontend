import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  badge?: string;
  title: React.ReactNode;
  description: React.ReactNode;
  icon?: LucideIcon;
  iconText?: string;
  action?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  iconText,
  action 
}: PageHeaderProps) {
  const renderTitle = (value: React.ReactNode) => {
    if (typeof value !== 'string') return value;
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return value;
    const lastWord = words.pop();
    const prefix = words.join(' ');
    return (
      <span className="inline-flex flex-wrap items-baseline gap-2">
        <span className="font-light">{prefix}</span>
        <span className="font-bold">{lastWord}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{renderTitle(title)}</h1>
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

