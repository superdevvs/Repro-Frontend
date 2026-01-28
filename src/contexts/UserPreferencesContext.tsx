import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type TemperatureUnit = 'fahrenheit' | 'celsius';
export type TimeFormat = '12h' | '24h';

interface UserPreferences {
  temperatureUnit: TemperatureUnit;
  timeFormat: TimeFormat;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setTimeFormat: (format: TimeFormat) => void;
  formatTemperature: (fahrenheit: number) => string;
  formatTime: (time: string) => string;
  formatDate: (date: Date | string | null | undefined) => string;
}

const defaultPreferences: UserPreferences = {
  temperatureUnit: 'fahrenheit',
  timeFormat: '12h',
};

const STORAGE_KEY = 'user_preferences';

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save user preferences:', e);
    }
  }, [preferences]);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setPreferences(prev => ({ ...prev, temperatureUnit: unit }));
  }, []);

  const setTimeFormat = useCallback((format: TimeFormat) => {
    setPreferences(prev => ({ ...prev, timeFormat: format }));
  }, []);

  const formatTemperature = useCallback((fahrenheit: number): string => {
    if (preferences.temperatureUnit === 'celsius') {
      const celsius = Math.round((fahrenheit - 32) * 5 / 9);
      return `${celsius}°C`;
    }
    return `${Math.round(fahrenheit)}°F`;
  }, [preferences.temperatureUnit]);

  const formatTime = useCallback((time: string): string => {
    if (!time || time === 'TBD') return time;
    
    // Parse time - handle various formats
    let hours: number;
    let minutes: number;
    
    // Check if already in 12h format (e.g., "3:30 PM")
    const match12h = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12h) {
      hours = parseInt(match12h[1], 10);
      minutes = parseInt(match12h[2], 10);
      const isPM = match12h[3].toUpperCase() === 'PM';
      
      if (preferences.timeFormat === '24h') {
        // Convert 12h to 24h
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
      // Already in 12h format
      return time;
    }
    
    // Check if in 24h format (e.g., "15:30")
    const match24h = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
      hours = parseInt(match24h[1], 10);
      minutes = parseInt(match24h[2], 10);
      
      if (preferences.timeFormat === '12h') {
        // Convert 24h to 12h
        const isPM = hours >= 12;
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
      }
      // Already in 24h format
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // Return original if format not recognized
    return time;
  }, [preferences.timeFormat]);

  // Format date as "Day Month_Name Year" (e.g., "18 December 2025")
  const formatDate = useCallback((date: Date | string | null | undefined): string => {
    if (!date) return '';
    
    let dateObj: Date;
    if (typeof date === 'string') {
      // Handle various date string formats
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        // Try parsing as YYYY-MM-DD
        const parts = date.split('-');
        if (parts.length === 3) {
          dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          return date; // Return original if can't parse
        }
      }
    } else {
      dateObj = date;
    }
    
    if (isNaN(dateObj.getTime())) return '';
    
    const day = dateObj.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    
    return `${day} ${month} ${year}`;
  }, []);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        setTemperatureUnit,
        setTimeFormat,
        formatTemperature,
        formatTime,
        formatDate,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}
