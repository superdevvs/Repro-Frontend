import { Home, Layers, Settings2, Building2, KeyRound, Sparkles } from 'lucide-react';
import { AutoExpandingTabsList } from '@/components/ui/auto-expanding-tabs';

const tabs = [
  { value: 'zillow', label: 'Zillow', icon: Home },
  { value: 'bright_mls', label: 'Bright MLS', icon: Layers },
  { value: 'iguide', label: 'iGUIDE', icon: Settings2 },
  { value: 'mmm', label: 'MMM', icon: Building2 },
  { value: 'repro_api', label: 'Repro API', icon: KeyRound },
  { value: 'copilot', label: 'ChatGPT', icon: Sparkles },
];

export function IntegrationTabs({ value }: { value: string }) {
  return <AutoExpandingTabsList tabs={tabs} value={value} ariaLabel="Integration providers" />;
}
