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

  const iconSizeClass = isMobile ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5';
  
  // Step icons for visual representation
  const stepIcons = [
    <MapPin key="location" className={iconSizeClass} />,
    <Calendar key="calendar" className={iconSizeClass} />,
    <ClipboardCheck key="review" className={iconSizeClass} />
  ];
  
  // Step labels
  const stepLabels = [
    'Property Details',
    'Schedule',
    'Review'
  ];

  const visibleStepLabels = isMobile
    ? ['Property', 'Schedule', 'Review']
    : stepLabels;

  const connectorClass = isMobile
    ? 'flex-1 min-w-[10px] h-0.5'
    : 'h-0.5 w-14 md:w-16 lg:w-20 flex-none';
  
  return (
    <div className="w-full lg:w-fit overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3 py-2 sm:px-3.5 sm:py-2">
      <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
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
              'bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30'
            : // inactive
              'bg-gray-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

        // separator classes
        const separatorClasses = isCompleted
          ? 'bg-blue-500 dark:bg-blue-400'
          : 'bg-gray-200 dark:bg-slate-700';

        return (
          <div key={`step-${stepIndex}`} className="contents">
            <div className="flex items-center gap-2 sm:gap-1.5 min-w-0 shrink-0">
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: isActive || isCompleted ? 1 : 0.98 }}
                transition={{ duration: 0.18 }}
                className={`relative h-7 w-7 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full shrink-0 flex items-center justify-center text-[10px] transition-colors duration-300 ${circleClasses}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${stepLabels[index]} ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <div className="flex items-center justify-center">
                    {stepIcons[index]}
                  </div>
                )}

              </motion.div>

              <span className={`text-[11px] sm:text-[11px] font-medium whitespace-nowrap ${isCompleted ? 'text-slate-700 dark:text-slate-200' : isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                {visibleStepLabels[index]}
              </span>
            </div>

            {index < totalSteps - 1 && (
              <Separator className={`${connectorClass} ${separatorClasses}`} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
