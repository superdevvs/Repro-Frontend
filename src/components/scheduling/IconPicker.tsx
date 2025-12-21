import React from 'react';
import { 
  Camera, 
  Video, 
  Film, 
  Plane, 
  Box, 
  LayoutTemplate, 
  Zap, 
  Home, 
  Image, 
  RotateCcw, 
  CloudRain, 
  Building,
  BoxSelect,
  Layers,
  View,
  Map,
  AlertCircle,
  Clock,
  Car,
  Sun,
  Briefcase,
  Cuboid,
  Scan,
  Globe,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export const AVAILABLE_ICONS = [
  { name: 'Camera', icon: Camera },
  { name: 'Video', icon: Video },
  { name: 'Film', icon: Film },
  { name: 'Plane', icon: Plane },
  { name: 'Box', icon: Box },
  { name: 'LayoutTemplate', icon: LayoutTemplate },
  { name: 'Zap', icon: Zap },
  { name: 'Home', icon: Home },
  { name: 'Image', icon: Image },
  { name: 'RotateCcw', icon: RotateCcw },
  { name: 'CloudRain', icon: CloudRain },
  { name: 'Building', icon: Building },
  { name: 'BoxSelect', icon: BoxSelect },
  { name: 'Layers', icon: Layers },
  { name: 'View', icon: View },
  { name: 'Map', icon: Map },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'Clock', icon: Clock },
  { name: 'Car', icon: Car },
  { name: 'Sun', icon: Sun },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Cuboid', icon: Cuboid },
  { name: 'Scan', icon: Scan },
  { name: 'Globe', icon: Globe },
  { name: 'Package', icon: Package },
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = React.useState(false);
  
  // Find the currently selected icon component
  const SelectedIcon = AVAILABLE_ICONS.find(i => i.name === value)?.icon || Camera;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-start gap-2">
          <SelectedIcon className="h-4 w-4" />
          <span>{value || 'Select Icon'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <ScrollArea className="h-[300px] p-4">
          <div className="grid grid-cols-4 gap-4">
            {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
              <Button
                key={name}
                variant={value === name ? "default" : "ghost"}
                className="flex flex-col items-center gap-2 h-auto p-4"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs truncate w-full text-center">{name}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function getIconComponent(name: string) {
  return AVAILABLE_ICONS.find(i => i.name === name)?.icon || Camera;
}
