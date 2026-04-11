
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Initialize with undefined
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Run in browser only
    if (typeof window !== 'undefined') {
      // Check for saved theme preference
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      // If no saved preference, check system preference
      if (!savedTheme) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      return savedTheme;
    }
    
    // Default theme for SSR
    return 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Save theme preference
    localStorage.setItem('theme', theme);
    
    // Apply theme to document
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Create the context value
  const contextValue = React.useMemo(() => {
    return { theme, setTheme };
  }, [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}
