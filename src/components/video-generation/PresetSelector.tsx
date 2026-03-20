import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cloud, Sunset, Moon, Sofa, Plane, DoorOpen, Users, HardHat, Film, Camera, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVideoPresets } from '@/hooks/useVideoGeneration';
import type { VideoPreset } from '@/services/higgsFieldService';

interface PresetSelectorProps {
  selectedPreset: VideoPreset | null;
  onSelect: (preset: VideoPreset) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Cloud: <Cloud className="h-8 w-8" />,
  Sunset: <Sunset className="h-8 w-8" />,
  Moon: <Moon className="h-8 w-8" />,
  Sofa: <Sofa className="h-8 w-8" />,
  Plane: <Plane className="h-8 w-8" />,
  DoorOpen: <DoorOpen className="h-8 w-8" />,
  Users: <Users className="h-8 w-8" />,
  HardHat: <HardHat className="h-8 w-8" />,
  Film: <Film className="h-8 w-8" />,
  Camera: <Camera className="h-8 w-8" />,
  Sparkles: <Sparkles className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
};

const CATEGORIES = ['All', 'Lighting', 'Movement', 'Staging', 'Specialty'];

export function PresetSelector({ selectedPreset, onSelect }: PresetSelectorProps) {
  const { data: presets, isLoading } = useVideoPresets();
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredPresets =
    activeCategory === 'All'
      ? presets
      : presets?.filter((p) => p.category === activeCategory);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Choose a Video Preset
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select the type of video you want to create from your property photos
        </p>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPresets?.map((preset) => {
          const isSelected = selectedPreset?.id === preset.id;
          return (
            <motion.div
              key={preset.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
                }`}
                onClick={() => onSelect(preset)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <div
                    className={`p-3 rounded-xl ${
                      isSelected
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {ICON_MAP[preset.icon] || <Film className="h-8 w-8" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {preset.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {preset.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {preset.max_frames === 1 ? '1 image' : 'Up to 2 images'}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filteredPresets?.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">
          No presets found in this category
        </p>
      )}
    </div>
  );
}
