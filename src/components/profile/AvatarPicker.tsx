import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { getSelectableAvatars } from '@/utils/defaultAvatars';

interface AvatarPickerProps {
  selectedAvatar?: string;
  onSelect: (avatarUrl: string) => void;
  className?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedAvatar,
  onSelect,
  className,
}) => {
  const avatars = getSelectableAvatars();

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-muted-foreground">
        Or choose a default avatar:
      </label>
      <div className="grid grid-cols-5 gap-2">
        {avatars.map((avatar) => {
          const isSelected = selectedAvatar === avatar;
          return (
            <button
              key={avatar}
              type="button"
              onClick={() => onSelect(avatar)}
              className={cn(
                'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                'hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary',
                isSelected
                  ? 'border-primary ring-2 ring-inset ring-primary'
                  : 'border-transparent hover:border-muted-foreground/30'
              )}
            >
              <img
                src={avatar}
                alt="Avatar option"
                className="w-full h-full object-cover"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="bg-primary rounded-full p-1">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AvatarPicker;
