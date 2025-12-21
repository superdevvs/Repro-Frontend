import React from 'react';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { Check, MapPin, Calendar, ClipboardCheck } from 'lucide-react';

interface BookingStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function BookingStepIndicator({ currentStep, totalSteps }: BookingStepIndicatorProps) {
  const isMobile = useIsMobile();
  
  // Step icons for visual representation
  const stepIcons = [
    <MapPin key="location" className="h-4 w-4" />,
    <Calendar key="calendar" className="h-4 w-4" />,
    <ClipboardCheck key="review" className="h-4 w-4" />
  ];
  
  // Step labels
  const stepLabels = [
    'Property Details',
    'Schedule',
    'Review'
  ];
  
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-4 min-w-max py-2">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepIndex = index + 1;
        const isCompleted = currentStep > stepIndex;
        const isActive = currentStep === stepIndex;

        // circle classes (theme-aware)
        const circleClasses = isCompleted
          ? // completed
            'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
          : isActive
            ? // active
              'bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400 ring-4 ring-blue-100 dark:ring-blue-900/30'
            : // inactive
              'bg-gray-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

        // separator classes
        const separatorClasses = isCompleted
          ? 'bg-blue-500 dark:bg-blue-400'
          : 'bg-gray-200 dark:bg-slate-700';

        return (
          <div key={`step-${stepIndex}`} className="flex items-center gap-3">
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: isActive || isCompleted ? 1 : 0.98 }}
              transition={{ duration: 0.18 }}
              className={`relative h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-[11px] md:text-xs transition-colors duration-300 ${circleClasses}`}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${stepLabels[index]} ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}
            >
              {isCompleted ? (
                <Check className="h-5 w-5" />
              ) : (
                <div className="flex items-center justify-center">
                  {stepIcons[index]}
                </div>
              )}

            </motion.div>

            <span className={`text-xs font-medium whitespace-nowrap ${isCompleted ? 'text-slate-700 dark:text-slate-200' : isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
              {stepLabels[index]}
            </span>

            {index < totalSteps - 1 && (
              <Separator className={`w-12 h-0.5 ${separatorClasses}`} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
