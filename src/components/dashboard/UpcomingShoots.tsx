
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRightIcon, CameraIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShoots } from '@/context/ShootsContext';
import { compareAsc, format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

interface UpcomingShootsProps {
  className?: string;
}

export function UpcomingShoots({ className }: UpcomingShootsProps) {
  const { shoots } = useShoots();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Get today's date at the beginning of the day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Filter and sort upcoming shoots
  const upcomingShoots = shoots
    .filter(shoot => {
      // Only include scheduled shoots
      if (shoot.status !== 'scheduled') return false;
      
      // Only include shoots scheduled for today or in the future
      const shootDate = parseISO(shoot.scheduledDate);
      return compareAsc(shootDate, today) >= 0;
    })
    .sort((a, b) => {
      // Sort by date, earliest first
      return compareAsc(parseISO(a.scheduledDate), parseISO(b.scheduledDate));
    })
    // For mobile, show fewer shoots
    .slice(0, isMobile ? 3 : 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={cn("w-full", className)}
    >
      <Card className="glass-card">
        <CardHeader className={`flex flex-row items-center justify-between ${isMobile ? 'p-3' : 'pb-2'} border-b border-border`}>
          <div className="flex items-center gap-2">
            <CameraIcon className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
            <CardTitle className={isMobile ? "text-base" : ""}>Upcoming Shoots</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`gap-1 ${isMobile ? 'px-2 py-1 h-7 text-xs' : ''}`}
            onClick={() => navigate('/shoot-history')}
          >
            View all <ArrowRightIcon className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
          </Button>
        </CardHeader>
        
        <CardContent className={isMobile ? "p-3" : "p-4"}>
          {upcomingShoots.length > 0 ? (
            <div className="space-y-3">
              {upcomingShoots.map((shoot, index) => (
                <div 
                  key={shoot.id}
                  className={`bg-secondary/10 ${isMobile ? 'p-2' : 'p-3'} rounded-md cursor-pointer hover:bg-secondary/20 transition-colors`}
                  onClick={() => navigate(`/shoots/${shoot.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium line-clamp-1 ${isMobile ? 'text-sm' : ''}`}>
                        {shoot.location.fullAddress}
                      </p>
                      <div className={`flex flex-wrap gap-2 ${isMobile ? 'mt-1' : 'mt-2'}`}>
                        <Badge variant="outline" className={`${isMobile ? 'text-xs py-0 h-5' : ''}`}>
                          {format(parseISO(shoot.scheduledDate), 'MMM d, yyyy')}
                        </Badge>
                        <Badge variant="outline" className={`text-xs bg-primary/10 ${isMobile ? 'py-0 h-5' : ''}`}>
                          ${shoot.payment.totalQuote}
                        </Badge>
                      </div>
                    </div>
                    <Badge className="capitalize">
                      {shoot.status}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-2 ${isMobile ? 'mt-2 text-xs' : 'mt-3 text-sm'} text-muted-foreground`}>
                    <div className={`${isMobile ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-xs'} rounded-full bg-secondary flex items-center justify-center`}>
                      {shoot.photographer.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span>{shoot.photographer.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center ${isMobile ? 'py-6' : 'py-8'} text-center`}>
              <p className="text-muted-foreground">No upcoming shoots scheduled.</p>
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                className="mt-4"
                onClick={() => navigate('/book-shoot')}
              >
                Book a Shoot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
