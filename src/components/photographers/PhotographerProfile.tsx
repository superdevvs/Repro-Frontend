import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatUserRoleLabel } from '@/utils/userRoleLabels';
import { MapPinIcon, CameraIcon, StarIcon, Mail, Edit } from 'lucide-react';

type Photographer = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
  rating: number;
  shootsCompleted: number;
  specialties: string[];
  status: 'available' | 'busy' | 'offline';
};

interface PhotographerProfileProps {
  photographer: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    location: string;
    rating: number;
    shootsCompleted: number;
    specialties: string[];
    status: 'available' | 'busy' | 'offline';
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  profileType?: 'photographers' | 'editors';
}

export function PhotographerProfile({ 
  photographer, 
  open, 
  onOpenChange,
  onEdit,
  profileType = 'photographers'
}: PhotographerProfileProps) {
  const isEditorProfile = profileType === 'editors';
  const entityType = isEditorProfile
    ? formatUserRoleLabel('editor', photographer as any)
    : 'Photographer';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'busy':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'offline':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return '';
    }
  };

  const statusColor = getStatusColor(photographer.status);
  const statusLabel = photographer.status.charAt(0).toUpperCase() + photographer.status.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entityType} Profile</DialogTitle>
          <DialogDescription>
            View detailed information about this {entityType.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={photographer.avatar} alt={photographer.name} />
              <AvatarFallback>{photographer.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{photographer.name}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPinIcon className="h-3.5 w-3.5" />
                <span>{photographer.location}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{photographer.email}</span>
              </div>
              <Badge className={statusColor}>
                {statusLabel}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Rating</div>
              <div className="flex items-center">
                <StarIcon className="h-4 w-4 text-yellow-500 mr-1" />
                <span className="font-medium">{photographer.rating}/5.0</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Shoots Completed</div>
              <div className="flex items-center">
                <CameraIcon className="h-4 w-4 text-primary mr-1" />
                <span className="font-medium">{photographer.shootsCompleted}</span>
              </div>
            </div>
          </div>

          {/* Specialties */}
          <div>
            <h4 className="text-sm font-medium mb-2">Specialties</h4>
            <div className="flex flex-wrap gap-2">
              {photographer.specialties.map((specialty) => (
                <Badge key={specialty} variant="secondary">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
