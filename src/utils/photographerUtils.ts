import { ShootData } from '@/types/shoots';
import { addDays, startOfDay } from 'date-fns';
import { calendarDay } from '@/lib/date';
import { getShootSchedule } from '@/utils/shootSchedule';

// Helper function to determine photographer status based on recent activity
export const determinePhotographerStatus = (photographerName: string, allShoots: ShootData[]): 'available' | 'busy' | 'offline' => {
  // Get current date
  const today = startOfDay(new Date());
  
  // Find recent and upcoming shoots for this photographer
  const scheduledDays = allShoots
    .filter(shoot => shoot.photographer.name === photographerName)
    .map(shoot => calendarDay(getShootSchedule(shoot).date))
    .filter(date => !Number.isNaN(date.getTime()));
  const recentDays = scheduledDays.filter(date => date <= today)
    .sort((a, b) => b.getTime() - a.getTime());
  
  const hasUpcomingShoots = scheduledDays.some(date => date > today && date < addDays(today, 7));
  
  // If no recent shoots in the last 30 days, consider offline
  if (recentDays.length === 0 || recentDays[0] < addDays(today, -30)) {
    return 'offline';
  }
  
  // If has upcoming shoots in the next 7 days, consider busy
  if (hasUpcomingShoots) {
    return 'busy';
  }
  
  // Otherwise available
  return 'available';
};

// Helper function to determine photographer specialties based on shoot services
export const determinePhotographerSpecialties = (photographerName: string, allShoots: ShootData[]): string[] => {
  // Get all services from shoots by this photographer
  const services = allShoots
    .filter(shoot => shoot.photographer.name === photographerName)
    .flatMap(shoot => shoot.services);
    
  // Count occurrences of each service
  const serviceCounts = services.reduce((acc, service) => {
    acc[service] = (acc[service] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get top specialties (top 3 most frequent services)
  const topSpecialties = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([service]) => service);
    
  // If no services found, return some default specialties
  if (topSpecialties.length === 0) {
    return ['Residential', 'Commercial', 'HDR'].sort(() => 0.5 - Math.random()).slice(0, 3);
  }
  
  return topSpecialties;
};

// Helper function to calculate photographer rating based on completed shoots
export const calculatePhotographerRating = (completedShoots: number): string => {
  // Base rating on number of completed shoots (simplified example)
  let baseRating = 3.5; // Start with a middle rating
  
  if (completedShoots > 20) {
    baseRating = 4.9;
  } else if (completedShoots > 10) {
    baseRating = 4.5;
  } else if (completedShoots > 5) {
    baseRating = 4.2;
  } else if (completedShoots > 0) {
    baseRating = 3.8;
  }
  
  // Add a small random variation
  const variation = (Math.random() * 0.4) - 0.2; // -0.2 to +0.2
  const finalRating = Math.min(5.0, Math.max(3.0, baseRating + variation));
  
  return finalRating.toFixed(1);
};
