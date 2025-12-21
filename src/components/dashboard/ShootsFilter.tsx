
import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { GridIcon, List, Search, Layers, Calendar, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/use-media-query';

interface ShootsFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedTab: string;
  setSelectedTab: (value: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (value: 'grid' | 'list') => void;
}

export function ShootsFilter({
  searchTerm,
  setSearchTerm,
  selectedTab,
  setSelectedTab,
  viewMode,
  setViewMode,
}: ShootsFilterProps) {
  const navigate = useNavigate();
  
  // Auto-expanding tabs configuration
  const tabsConfig: AutoExpandingTab[] = useMemo(() => [
    {
      value: 'all',
      icon: Layers,
      label: 'All',
    },
    {
      value: 'scheduled',
      icon: Calendar,
      label: 'Scheduled',
    },
    {
      value: 'completed',
      icon: CheckCircle2,
      label: 'Completed',
    },
  ], []);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-border pr-8"
          />
          {searchTerm && (
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className="h-9 w-9"
          >
            <GridIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            className="h-9 w-9"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <AutoExpandingTabsList 
          tabs={tabsConfig} 
          value={selectedTab}
          variant="compact"
        />
      </Tabs>
    </div>
  );
}
