
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface WeatherDataProps {
  date?: Date;
  time?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
}

interface WeatherData {
  temperature: string;
  condition: string;
  distance: string | number;
}

export function useWeatherData({ date, time, city, state, zip, address }: WeatherDataProps): WeatherData {
  const [weatherData, setWeatherData] = useState<WeatherData>({
    temperature: '24',
    condition: 'Partly Cloudy',
    distance: '5'
  });

  useEffect(() => {
    // Fetch weather data based on actual date, time, and location
    if (date && (city || zip || address)) {
      const fetchWeather = async () => {
        try {
          // For now, using mock data but based on actual parameters
          // In production, integrate with a weather API like OpenWeatherMap
          // Example: `https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}`
          
          // Generate realistic weather based on date (season-based) — values in °C
          const month = date.getMonth() + 1; // 1-12
          const isWinter = month >= 12 || month <= 2;
          const isSpring = month >= 3 && month <= 5;
          const isSummer = month >= 6 && month <= 8;
          const isFall = month >= 9 && month <= 11;
          
          // Base temperature by season (°C)
          let baseTemp = 21; // ~70°F
          if (isWinter) baseTemp = 7;   // ~45°F
          else if (isSpring) baseTemp = 18; // ~65°F
          else if (isSummer) baseTemp = 29; // ~85°F
          else if (isFall) baseTemp = 16;   // ~60°F
          
          // Adjust temperature based on time of day (if time provided)
          if (time) {
            const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10);
              const period = timeMatch[3].toUpperCase();
              if (period === 'PM' && hours !== 12) hours += 12;
              if (period === 'AM' && hours === 12) hours = 0;
              
              // Temperature is typically highest in afternoon (2-4 PM)
              if (hours >= 14 && hours <= 16) {
                baseTemp += 3; // Warmer in afternoon
              } else if (hours >= 6 && hours <= 8) {
                baseTemp -= 3; // Cooler in early morning
              } else if (hours >= 20 || hours <= 5) {
                baseTemp -= 6; // Cooler at night
              }
            }
          }
          
          // Add some variation (°C)
          const tempVariation = Math.floor(Math.random() * 10) - 5;
          const temperature = Math.max(-7, Math.min(38, baseTemp + tempVariation));
          
          // Weather conditions based on season
          let conditions: string[];
          if (isWinter) {
            conditions = ['Cloudy', 'Partly Cloudy', 'Rainy', 'Clear'];
          } else if (isSpring) {
            conditions = ['Partly Cloudy', 'Sunny', 'Rainy', 'Cloudy'];
          } else if (isSummer) {
            conditions = ['Sunny', 'Partly Cloudy', 'Clear', 'Cloudy'];
          } else {
            conditions = ['Partly Cloudy', 'Cloudy', 'Sunny', 'Rainy'];
          }
          
          const condition = conditions[Math.floor(Math.random() * conditions.length)];
          
          setWeatherData({
            temperature: temperature.toString(),
            condition,
            distance: '5' // This is not used for weather display
          });
          
          const locationStr = address ? `${address}, ` : '';
          const fullLocation = `${locationStr}${city || ''}, ${state || ''} ${zip || ''}`.trim();
          console.log(`Weather data for ${fullLocation} on ${format(date, 'yyyy-MM-dd')}${time ? ` at ${time}` : ''}: ${temperature}°C, ${condition}`);
        } catch (error) {
          console.error('Error fetching weather:', error);
          // Keep default values on error
        }
      };
      
      const timeoutId = setTimeout(fetchWeather, 300);
      return () => clearTimeout(timeoutId);
    } else {
      // Reset to defaults if no location/date
      setWeatherData({
        temperature: '24',
        condition: 'Partly Cloudy',
        distance: '5'
      });
    }
  }, [date, time, city, state, zip, address]);
  
  return weatherData;
}
