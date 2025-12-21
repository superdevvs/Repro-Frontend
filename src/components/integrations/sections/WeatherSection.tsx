import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { CloudSun, CloudRain, Gauge } from 'lucide-react';
import {
  getWeatherProvider,
  setWeatherProvider,
  subscribeToWeatherProvider,
  WeatherProvider,
} from '@/state/weatherProviderStore';

const providerOptions: Array<{
  value: WeatherProvider;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'openweather',
    label: 'OpenWeather',
    description: 'Global 3-hour forecasts with strong metro coverage.',
    icon: <CloudSun className="h-4 w-4" />,
  },
  {
    value: 'accuweather',
    label: 'AccuWeather',
    description: 'Hyperlocal hourly data tuned for field teams.',
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    value: 'weatherapi',
    label: 'WeatherAPI.com',
    description: 'Fast, lightweight API with generous rate limits.',
    icon: <CloudRain className="h-4 w-4" />,
  },
];

export function WeatherSection() {
  const [provider, setProvider] = useState<WeatherProvider>(getWeatherProvider());

  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider((next) => setProvider(next));
    return unsubscribe;
  }, []);

  const handleChange = (next: string) => {
    const value = next as WeatherProvider;
    setProvider(value);
    setWeatherProvider(value);
    toast({
      title: 'Weather provider updated',
      description: `Dashboard weather will refresh using ${providerOptions.find(
        (option) => option.value === value,
      )?.label}.`,
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Weather providers</CardTitle>
        <CardDescription>
          Choose which API powers in-app forecasts. Switching providers triggers a live refresh of
          weather chips across the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={provider} onValueChange={handleChange} className="space-y-3">
          {providerOptions.map((option) => (
            <Label
              key={option.value}
              htmlFor={`weather-${option.value}`}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <RadioGroupItem id={`weather-${option.value}`} value={option.value} />
              <div className="flex items-center gap-3 flex-1">
                <div className="rounded-lg bg-primary/10 text-primary p-2">{option.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          API keys are managed in environment configuration. If a provider experiences an outage,
          the dashboard automatically falls back to the next available API.
        </p>
      </CardContent>
    </Card>
  );
}

