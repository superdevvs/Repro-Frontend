
import { useState, useEffect } from 'react';
import { useShoots } from '@/context/ShootsContext';
import { PhotographerFromShoots } from '@/types/photographers';
import { 
  determinePhotographerStatus, 
  determinePhotographerSpecialties, 
  calculatePhotographerRating 
} from '@/utils/photographerUtils';

export function usePhotographersData() {
  const { shoots } = useShoots();
  const [photographersList, setPhotographersList] = useState<PhotographerFromShoots[]>([]);

  // Extract photographers from shoots data on component mount
  useEffect(() => {
    // Create a Map to aggregate photographer data from all shoots
    const photographersMap = new Map<string, PhotographerFromShoots>();
    
    shoots.forEach(shoot => {
      const { photographer } = shoot;
      
      if (!photographersMap.has(photographer.name)) {
        // Count completed shoots for this photographer
        const completedShoots = shoots.filter(s => 
          s.photographer.name === photographer.name && s.status === 'completed'
        ).length;
        
        // Get all locations where this photographer has shoots
        const photographerLocations = shoots
          .filter(s => s.photographer.name === photographer.name)
          .map(s => `${s.location.city}, ${s.location.state}`)
          .filter((loc, index, self) => self.indexOf(loc) === index); // Remove duplicates
        
        // Get main location (most frequent)
        const locationCounts = photographerLocations.reduce((acc, loc) => {
          acc[loc] = (acc[loc] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Get location with highest count
        const primaryLocation = Object.entries(locationCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        
        photographersMap.set(photographer.name, {
          id: String(photographer.id || photographer.name.replace(/\s+/g, '-').toLowerCase()),
          name: photographer.name,
          // Generate default email since it's not available in the shoot data
          email: `${photographer.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          avatar: photographer.avatar || `https://ui.shadcn.com/avatars/0${Math.floor(Math.random() * 5) + 1}.png`,
          shootsCompleted: completedShoots,
          // Determine status based on recent shoots
          status: determinePhotographerStatus(photographer.name, shoots),
          // Determine specialties based on services from shoots
          specialties: determinePhotographerSpecialties(photographer.name, shoots),
          // Calculate rating based on completed shoots
          rating: calculatePhotographerRating(completedShoots),
          // Use the primary location
          location: primaryLocation,
        });
      }
    });
    
    setPhotographersList(Array.from(photographersMap.values()));
  }, [shoots]);

  return { photographersList, setPhotographersList };
}
