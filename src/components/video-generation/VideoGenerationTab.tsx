import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Film } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoGenerationWizard } from './VideoGenerationWizard';
import { VideoJobsDashboard } from './VideoJobsDashboard';
import { ProcessingView } from './ProcessingView';

type SubView = 'create' | 'dashboard' | 'job-detail';

export function VideoGenerationTab() {
  const isMobile = useIsMobile();
  const [subView, setSubView] = useState<SubView>('create');
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const handleViewJob = (jobId: number) => {
    setActiveJobId(jobId);
    setSubView('job-detail');
  };

  return (
    <div className="space-y-4">
      {/* Inline header with sub-view toggle */}
      {subView !== 'job-detail' && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {subView === 'create' ? 'Create Video' : 'My Videos'}
          </h2>
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <Button
              variant={subView === 'create' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('create')}
              className={`h-8 ${subView === 'create' ? '' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create
            </Button>
            <Button
              variant={subView === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubView('dashboard')}
              className={`h-8 ${subView === 'dashboard' ? '' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <Film className="h-3.5 w-3.5 mr-1" />
              My Videos
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {subView === 'create' && <VideoGenerationWizard />}

      {subView === 'dashboard' && <VideoJobsDashboard onViewJob={handleViewJob} />}

      {subView === 'job-detail' && activeJobId && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSubView('dashboard')}>
            &larr; Back to My Videos
          </Button>
          <ProcessingView
            jobId={activeJobId}
            onCreateAnother={() => setSubView('create')}
          />
        </div>
      )}
    </div>
  );
}
