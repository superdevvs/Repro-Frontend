
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter';
import { TimeRange } from '@/utils/dateUtils';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion } from 'framer-motion';
import { HardDriveIcon } from 'lucide-react';

interface DashboardHeaderProps {
  isAdmin: boolean;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isAdmin,
  timeRange,
  onTimeRangeChange
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Get user name or username if available
  const userName = user?.name || 'there';
  const timeOfDay = getTimeOfDay();

  return (
    <div className="relative overflow-hidden rounded-xl mb-8">
      {/* Background gradient */}
      <div
        className={`absolute inset-0 ${theme === 'dark'
            ? 'bg-gradient-to-r from-indigo-900/30 via-purple-800/30 to-pink-800/30'
            : 'bg-gradient-to-r from-blue-50 via-indigo-100 to-purple-100'
          } rounded-xl`}
      />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/20 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between px-7 py-6 z-10">
        <div className="mb-6 md:mb-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* <Badge className="mb-2 bg-primary/20 text-primary hover:bg-primary/30 border-primary/20 px-3 py-0.5">
              Dashboard
            </Badge> */}

            <h1 className="text-3xl md:text-4xl font-bold mb-1">
              <span className="text-primary/80">{timeOfDay}, </span>
              <span className="text-foreground">{userName}!</span>
            </h1>

            <p className="text-muted-foreground max-w-md">
              {isAdmin
                ? "Here's an overview of your business stats and scheduled shoots."
                : "Here's what's happening with your shoots today."
              }
            </p>
          </motion.div>

          {isAdmin && (
            <motion.div
              className="flex flex-wrap gap-4 mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* <InfoBadge icon={<Camera className="h-4 w-4" />} label="Shoots" />
              <InfoBadge icon={<CalendarDays className="h-4 w-4" />} label="Schedule" />
              <InfoBadge icon={<Users className="h-4 w-4" />} label="Clients" />
              <InfoBadge icon={<TrendingUp className="h-4 w-4" />} label="Analytics" /> */}
            </motion.div>
          )}
        </div>

        <motion.div
          className="self-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <TimeRangeFilter
            selectedRange={timeRange}
            onChange={onTimeRangeChange}
          />
          {/* Storage — inline clean layout */}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <HardDriveIcon className="h-5 w-5 text-primary" />
            <span className="text-base font-medium text-foreground">12.4 GB</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">↑ 5%</span>
          </div>


        </motion.div>
      </div>
    </div>
  );
};

// Helper components and functions
const InfoBadge = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-sm text-muted-foreground">
    {icon}
    <span>{label}</span>
  </div>
);

// Get appropriate greeting based on time of day
const getTimeOfDay = () => {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
