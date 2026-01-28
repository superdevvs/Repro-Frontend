import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  isCollapsed?: boolean;
  variant?: 'light' | 'dark' | 'auto';
}

// Logo files in public folder:
// - /REPRO-HQ.png - White/light logo for dark backgrounds
// - /Repro HQ dark.png - Dark logo for light backgrounds
// - /REPRO-HQ-icon.png - Icon only

export function Logo({ className, isCollapsed = false, variant = 'auto' }: LogoProps) {
  if (isCollapsed) {
    // Show only the icon when collapsed
    return (
      <img 
        src="/REPRO-HQ-icon.png" 
        alt="REPRO Photos" 
        className={cn('h-full w-auto object-contain', className)}
      />
    );
  }

  // Full logo with text
  if (variant === 'dark') {
    // Dark logo for light backgrounds
    return (
      <img 
        src="/Repro HQ dark.png" 
        alt="REPRO Photos" 
        className={cn('h-full w-auto object-contain', className)}
      />
    );
  }

  if (variant === 'light') {
    // Light/white logo for dark backgrounds
    return (
      <img 
        src="/REPRO-HQ.png" 
        alt="REPRO Photos" 
        className={cn('h-full w-auto object-contain', className)}
      />
    );
  }

  // Auto variant: show dark logo in light mode, light logo in dark mode
  return (
    <>
      <img 
        src="/Repro HQ dark.png" 
        alt="REPRO Photos" 
        className={cn('h-full w-auto object-contain dark:hidden', className)}
      />
      <img 
        src="/REPRO-HQ.png" 
        alt="REPRO Photos" 
        className={cn('h-full w-auto object-contain hidden dark:block', className)}
      />
    </>
  );
}

