
import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter';
import { TimeRange, filterShootsByDateRange } from '@/utils/dateUtils';
import { useShoots } from '@/context/ShootsContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Grid3X3, 
  PlusCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  format, 
  addMonths, 
  subMonths, 
  isSameDay, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addDays, 
  getDay,
  getDate,
  isToday,
  isSameMonth,
  setDate,
  getMonth,
  getYear,
  startOfMonth,
  endOfMonth,
  setMonth,
  setYear
} from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

const ShootCalendar = () => {
  const { shoots } = useShoots();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState("month");
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  const filteredShoots = filterShootsByDateRange(shoots, timeRange);
  
  const goToPrevious = () => {
    if (viewType === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const goToNext = () => {
    if (viewType === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const getShootDays = () => {
    return shoots.map(shoot => parseISO(shoot.scheduledDate));
  };
  
  const shootDays = getShootDays();

  const generateMonthGrid = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    const weeks = [];
    let week = [];
    
    for (let i = 0; i < days.length; i++) {
      week.push(days[i]);
      
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    
    return weeks;
  };

  const generateWeekGrid = () => {
    const weekStart = startOfWeek(currentDate);
    return eachDayOfInterval({ 
      start: weekStart, 
      end: endOfWeek(weekStart) 
    });
  };

  const getShootsForDate = (date: Date) => {
    return shoots.filter(shoot => {
      const shootDate = parseISO(shoot.scheduledDate);
      return isSameDay(shootDate, date);
    });
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentDate);
    setMonth(newDate, parseInt(month));
    setCurrentDate(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentDate);
    setYear(newDate, parseInt(year));
    setCurrentDate(newDate);
  };

  const monthGrid = generateMonthGrid();
  const weekGrid = generateWeekGrid();
  const monthNames = Array.from({ length: 12 }, (_, i) => i.toString());
  const currentYear = getYear(new Date());
  const yearOptions = [
    (currentYear - 1).toString(),
    currentYear.toString(),
    (currentYear + 1).toString()
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <PageHeader
          badge="Calendar"
          title="Shoot Calendar"
          description="Track and manage your photography schedule."
        />
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
            <Button variant="outline" onClick={() => navigate('/book-shoot')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Book Shoot
            </Button>
            <Select defaultValue={viewType} onValueChange={setViewType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-primary" />
                
                <div className="flex items-center gap-2">
                  <Select value={getMonth(currentDate).toString()} onValueChange={handleMonthChange}>
                    <SelectTrigger className="w-[130px] h-8 text-base font-medium">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((month, index) => (
                        <SelectItem key={month} value={month}>
                          {format(new Date(2023, parseInt(month), 1), 'MMMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={getYear(currentDate).toString()} onValueChange={handleYearChange}>
                    <SelectTrigger className="w-[100px] h-8 text-base font-medium">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <div className="flex">
                  <Button variant="outline" size="icon" className="rounded-r-none" onClick={goToPrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-l-none" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <Tabs defaultValue="month" value={viewType} onValueChange={setViewType}>
                <div className="hidden">
                  <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="month" className="p-0 min-h-[calc(100vh-20rem)]">
                  <div className="grid grid-cols-7 border-b">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-2 text-center text-sm font-medium text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-col">
                    {monthGrid.map((week, weekIndex) => (
                      <div key={`week-${weekIndex}`} className="grid grid-cols-7 border-b last:border-0">
                        {week.map((day, dayIndex) => {
                          const isCurrentMonth = isSameMonth(day, currentDate);
                          const dayShootsList = getShootsForDate(day);
                          const hasEvents = dayShootsList.length > 0;
                          
                          return (
                            <div 
                              key={`day-${dayIndex}`} 
                              className={cn(
                                "min-h-[100px] p-1 border-r last:border-r-0",
                                !isCurrentMonth && "bg-muted/30",
                                isToday(day) && "bg-primary/5"
                              )}
                            >
                              <div className="flex flex-col h-full">
                                <div 
                                  className={cn(
                                    "flex justify-center items-center h-7 w-7 rounded-full text-sm mx-auto",
                                    isToday(day) && "bg-primary text-primary-foreground font-medium",
                                    !isCurrentMonth && "text-muted-foreground"
                                  )}
                                >
                                  {getDate(day)}
                                </div>
                                
                                <div className="mt-1 flex flex-col gap-1">
                                  {hasEvents && dayShootsList.slice(0, 3).map((shoot, index) => (
                                    <Button 
                                      key={`event-${index}`}
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-auto py-1 px-2 justify-start text-left text-xs truncate hover:bg-primary/10 hover:text-primary"
                                    >
                                      <div className="flex items-center gap-1.5 w-full">
                                        <Avatar className="h-4 w-4 border border-primary/20">
                                          <AvatarImage src={shoot.photographer.avatar} />
                                          <AvatarFallback className="text-[8px]">
                                            {shoot.photographer.name.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{shoot.client.name}</span>
                                      </div>
                                    </Button>
                                  ))}
                                  
                                  {dayShootsList.length > 3 && (
                                    <div className="text-xs text-center text-muted-foreground mt-1 px-2">
                                      +{dayShootsList.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="week" className="p-4 min-h-[calc(100vh-20rem)]">
                  <div className="grid grid-cols-7 gap-4">
                    {weekGrid.map((day, index) => {
                      const dayShootsList = getShootsForDate(day);
                      const dayName = format(day, 'EEE');
                      const dayNumber = format(day, 'd');
                      
                      return (
                        <div key={index} className="flex flex-col">
                          <div className="text-center mb-2">
                            <div className="text-sm text-muted-foreground">{dayName}</div>
                            <div 
                              className={cn(
                                "mx-auto h-7 w-7 flex items-center justify-center rounded-full text-sm",
                                isToday(day) && "bg-primary text-primary-foreground font-medium"
                              )}
                            >
                              {dayNumber}
                            </div>
                          </div>
                          
                          <div className="border rounded-md flex-1 min-h-[300px] bg-card">
                            <div className="p-2 space-y-2">
                              {dayShootsList.length > 0 ? (
                                dayShootsList.map((shoot, shootIndex) => (
                                  <div 
                                    key={`shoot-${shootIndex}`}
                                    className="p-2 bg-primary/5 rounded-md border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
                                  >
                                    <div className="text-sm font-medium">{shoot.client.name}</div>
                                    <div className="text-xs text-muted-foreground">{shoot.location.city}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
                                  <p>No shoots</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default ShootCalendar;
