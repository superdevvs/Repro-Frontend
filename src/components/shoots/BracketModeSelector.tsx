import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Camera } from 'lucide-react';

export type BracketMode = 3 | 5 | null;

interface BracketModeSelectorProps {
  value: BracketMode;
  onChange: (mode: BracketMode) => void;
  expectedDeliveredCount?: number;
}

export const BracketModeSelector: React.FC<BracketModeSelectorProps> = ({
  value,
  onChange,
  expectedDeliveredCount = 0,
}) => {
  const calculateExpectedRaw = (mode: BracketMode) => {
    if (!mode || !expectedDeliveredCount) return 0;
    return expectedDeliveredCount * mode;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Bracket Mode</Label>
      </div>
      
      <RadioGroup
        value={value?.toString() || 'single'}
        onValueChange={(val) => {
          if (val === 'single') {
            onChange(null);
          } else {
            onChange(parseInt(val) as 3 | 5);
          }
        }}
      >
        <Card className={value === null ? 'border-primary' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="single" id="single" className="mt-1" />
              <div className="flex-1">
                <Label
                  htmlFor="single"
                  className="text-sm font-medium cursor-pointer"
                >
                  Single Photo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  One photo per scene
                  {expectedDeliveredCount > 0 && (
                    <span className="ml-1 font-medium text-foreground">
                      ({expectedDeliveredCount} expected)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={value === 3 ? 'border-primary' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="3" id="3-bracket" className="mt-1" />
              <div className="flex-1">
                <Label
                  htmlFor="3-bracket"
                  className="text-sm font-medium cursor-pointer"
                >
                  3 Brackets
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Three exposures per scene for HDR
                  {expectedDeliveredCount > 0 && (
                    <span className="ml-1 font-medium text-foreground">
                      ({calculateExpectedRaw(3)} RAW expected)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={value === 5 ? 'border-primary' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="5" id="5-bracket" className="mt-1" />
              <div className="flex-1">
                <Label
                  htmlFor="5-bracket"
                  className="text-sm font-medium cursor-pointer"
                >
                  5 Brackets
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Five exposures per scene for advanced HDR
                  {expectedDeliveredCount > 0 && (
                    <span className="ml-1 font-medium text-foreground">
                      ({calculateExpectedRaw(5)} RAW expected)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </RadioGroup>

      {value && expectedDeliveredCount > 0 && (
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          <strong>Note:</strong> With {value} brackets, you should upload{' '}
          {calculateExpectedRaw(value)} RAW photos to deliver{' '}
          {expectedDeliveredCount} final images.
        </div>
      )}
    </div>
  );
};

