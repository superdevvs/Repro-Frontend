
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CameraIcon, MapPinIcon, InfoIcon, CalendarIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PhotographerFromShoots } from '@/types/photographers';

interface PhotographerCardProps {
  photographer: PhotographerFromShoots;
  onEdit: (photographer: PhotographerFromShoots) => void;
  onViewProfile: (photographer: PhotographerFromShoots) => void;
}

export function PhotographerCard({ photographer, onEdit, onViewProfile }: PhotographerCardProps) {
  return (
    <Card 
      key={photographer.id} 
      className="glass-card overflow-hidden hover:shadow-md transition-shadow rounded-lg border border-border animate-fadeIn"
    >
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-12 w-12 ring-2 ring-inset ring-primary/10">
              <AvatarImage src={photographer.avatar} alt={photographer.name} />
              <AvatarFallback>{photographer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-base">{photographer.name}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPinIcon className="h-3 w-3" />
                <span>{photographer.location || 'Location not specified'}</span>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    className={`ml-auto ${
                      photographer.status === 'available' 
                        ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                        : photographer.status === 'busy' 
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' 
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    }`}
                  >
                    {photographer.status === 'available' ? 'Available' : photographer.status === 'busy' ? 'Busy' : 'Offline'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {photographer.status === 'available' 
                    ? 'This photographer is available for bookings' 
                    : photographer.status === 'busy' 
                    ? 'This photographer is currently booked' 
                    : 'This photographer is offline'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <InfoIcon className="h-3.5 w-3.5" />
                Rating
              </span>
              <span className="font-medium">{photographer.rating || '0'}/5.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                Shoots
              </span>
              <span className="font-medium">{photographer.shootsCompleted}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {photographer.specialties?.map((specialty) => (
              <Badge key={specialty} variant="outline" className="text-xs">
                {specialty}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="p-4 bg-secondary/30 border-t border-border flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm">
            <CameraIcon className="h-4 w-4 text-primary" />
            <span>{photographer.shootsCompleted} shoots</span>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="hover:bg-accent transition-colors"
              onClick={() => onEdit(photographer)}
            >
              Edit
            </Button>
            <Button 
              size="sm"
              className="hover:bg-primary/90 transition-colors"
              onClick={() => onViewProfile(photographer)}
            >
              View Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
