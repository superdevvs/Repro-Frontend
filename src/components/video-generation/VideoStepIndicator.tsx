import React from 'react';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { Check, Sparkles, ImageIcon, Settings } from 'lucide-react';

interface VideoStepIndicatorProps {
  currentStep: number;
}

const steps = [
  { icon: <Sparkles className="h-4 w-4" />, label: 'Choose Preset' },
  { icon: <ImageIcon className="h-4 w-4" />, label: 'Select Images' },
  { icon: <Settings className="h-4 w-4" />, label: 'Configure' },
];

export function VideoStepIndicator({ currentStep }: VideoStepIndicatorProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-4 min-w-max py-2">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const isCompleted = currentStep > stepIndex;
          const isActive = currentStep === stepIndex;

          const circleClasses = isCompleted
            ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
            : isActive
              ? 'bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400 ring-4 ring-blue-100 dark:ring-blue-900/30'
              : 'bg-gray-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

          const separatorClasses = isCompleted
            ? 'bg-blue-500 dark:bg-blue-400'
            : 'bg-gray-200 dark:bg-slate-700';

          return (
            <div key={stepIndex} className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: isActive || isCompleted ? 1 : 0.98 }}
                transition={{ duration: 0.18 }}
                className={`relative h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs transition-colors duration-300 ${circleClasses}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${step.label} ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.icon}
              </motion.div>

              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isCompleted
                    ? 'text-slate-700 dark:text-slate-200'
                    : isActive
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {step.label}
              </span>

              {index < steps.length - 1 && (
                <Separator className={`w-12 h-0.5 ${separatorClasses}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
