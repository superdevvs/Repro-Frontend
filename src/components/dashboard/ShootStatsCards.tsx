import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileCheck, 
  ImageIcon,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShootStatsCardsProps {
  shoots: ShootData[];
}

export function ShootStatsCards({ shoots }: ShootStatsCardsProps) {
  // Calculate stats
  const scheduled = shoots.filter(s => s.status === 'scheduled' || s.status === 'booked').length;
  const pendingApproval = shoots.filter(s => 
    s.workflowStatus === 'editing_complete' || 
    s.workflowStatus === 'pending_review'
  ).length;
  const inEditing = shoots.filter(s => 
    s.workflowStatus === 'photos_uploaded' ||
    (s.status === 'completed' && s.workflowStatus && 
     !['admin_verified', 'completed'].includes(s.workflowStatus))
  ).length;
  const completed = shoots.filter(s => 
    s.workflowStatus === 'completed' || 
    s.workflowStatus === 'admin_verified' ||
    (s.status === 'completed' && (!s.workflowStatus || s.workflowStatus === 'completed'))
  ).length;
  const flagged = shoots.filter(s => s.isFlagged).length;

  const stats = [
    {
      label: 'Scheduled',
      value: scheduled,
      icon: Calendar,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500/20'
    },
    {
      label: 'Pending Approval',
      value: pendingApproval,
      icon: FileCheck,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-500/20'
    },
    {
      label: 'In Editing',
      value: inEditing,
      icon: ImageIcon,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-500/20'
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      color: 'bg-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500/20'
    },
    {
      label: 'Flagged',
      value: flagged,
      icon: AlertCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className={cn(
              "border-2 hover:shadow-lg transition-all cursor-pointer group",
              stat.borderColor
            )}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {stat.label}
                    </p>
                    <p className={cn("text-3xl font-bold", stat.textColor)}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={cn(
                    "p-3 rounded-lg",
                    stat.bgColor
                  )}>
                    <Icon className={cn("h-6 w-6", stat.textColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

