import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Square, Tv, AlertTriangle, Loader2 } from 'lucide-react';
import type { VideoPreset } from '@/services/higgsFieldService';

type AspectRatio = 'horizontal' | 'vertical' | 'square' | 'standard';

const ASPECT_RATIOS: { value: AspectRatio; label: string; sub: string; icon: React.ElementType }[] = [
  { value: 'horizontal', label: 'Horizontal', sub: '16:9 Landscape', icon: Monitor },
  { value: 'vertical', label: 'Vertical', sub: '9:16 Portrait', icon: Smartphone },
  { value: 'square', label: 'Square', sub: '1:1', icon: Square },
  { value: 'standard', label: 'Standard', sub: '4:3', icon: Tv },
];

interface ConfigureAndGenerateProps {
  preset: VideoPreset;
  shootAddress: string;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onGenerate: () => void;
  isSubmitting: boolean;
}

export function ConfigureAndGenerate({
  preset,
  shootAddress,
  aspectRatio,
  onAspectRatioChange,
  onGenerate,
  isSubmitting,
}: ConfigureAndGenerateProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Configure & Generate
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose the output format and review your settings
        </p>
      </div>

      {/* Aspect Ratio Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASPECT_RATIOS.map(({ value, label, sub, icon: Icon }) => (
            <Card
              key={value}
              className={`cursor-pointer transition-all ${
                aspectRatio === value
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:border-slate-300 dark:hover:border-slate-600'
              }`}
              onClick={() => onAspectRatioChange(value)}
            >
              <CardContent className="p-3 flex flex-col items-center gap-2">
                <div
                  className={`p-2.5 rounded-lg ${
                    aspectRatio === value
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Vertical info banner */}
      {aspectRatio === 'vertical' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Vertical Image Conversion
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              We'll generate 2-3 vertical variants of your images using AI. You'll pick the best ones
              before video generation starts.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <Card className="bg-slate-50 dark:bg-slate-800/50">
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Preset</span>
              <Badge variant="secondary">{preset.name}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Property</span>
              <span className="text-slate-900 dark:text-slate-100 text-right max-w-[200px] truncate">
                {shootAddress}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Aspect Ratio</span>
              <span className="text-slate-900 dark:text-slate-100">
                {ASPECT_RATIOS.find(r => r.value === aspectRatio)?.sub || aspectRatio}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate button */}
      <Button
        onClick={onGenerate}
        disabled={isSubmitting}
        className="w-full h-12 text-base font-medium"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Submitting...
          </>
        ) : (
          'Generate Video'
        )}
      </Button>
    </div>
  );
}
