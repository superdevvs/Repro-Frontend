import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ArrowRight, Clock, MapPin } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShootScheduleCardProps {
  shoots: ShootData[];
}

export function ShootScheduleCard({ shoots }: ShootScheduleCardProps) {
  const navigate = useNavigate();

  // Get upcoming scheduled shoots (next 7 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingShoots = shoots
    .filter(shoot => {
      if (shoot.status !== 'scheduled' && shoot.status !== 'booked') return false;
      if (!shoot.scheduledDate) return false;
      const shootDate = parseISO(shoot.scheduledDate);
      return shootDate >= today && shootDate <= nextWeek;
    })
    .sort((a, b) => {
      if (!a.scheduledDate || !b.scheduledDate) return 0;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    })
    .slice(0, 6);

  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM dd');
  };

  if (upcomingShoots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <CardTitle>Upcoming Schedule</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shoots')}
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming shoots scheduled</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate('/book-shoot')}
            >
              Book a Shoot
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <CardTitle>Upcoming Schedule</CardTitle>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
              {upcomingShoots.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/shoots')}
          >
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingShoots.map((shoot, index) => {
            const dateLabel = shoot.scheduledDate ? getDateLabel(shoot.scheduledDate) : 'TBD';
            const isTodayShoot = shoot.scheduledDate && isToday(parseISO(shoot.scheduledDate));
            
            return (
              <motion.div
                key={shoot.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer group",
                  isTodayShoot 
                    ? "border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10" 
                    : "border-border hover:bg-muted/50"
                )}
                onClick={() => navigate(`/shoots?id=${shoot.id}`)}
              >
                <div className={cn(
                  "flex flex-col items-center justify-center min-w-[60px] p-2 rounded-lg",
                  isTodayShoot ? "bg-blue-500/10" : "bg-muted"
                )}>
                  <span className={cn(
                    "text-xs font-medium",
                    isTodayShoot ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                  )}>
                    {dateLabel.split(',')[0]}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    isTodayShoot ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                  )}>
                    {shoot.scheduledDate ? format(parseISO(shoot.scheduledDate), 'dd') : '--'}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium text-sm truncate">
                      {shoot.location.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {shoot.time && (
                      <>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shoot.time}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>{shoot.photographer?.name || 'TBD'}</span>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

