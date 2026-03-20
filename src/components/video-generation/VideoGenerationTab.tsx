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
      {/* Sub-view toggle */}
      {subView !== 'job-detail' && (
        <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
          <Button
            variant={subView === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubView('create')}
            className={isMobile ? 'flex-1' : ''}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Video
          </Button>
          <Button
            variant={subView === 'dashboard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubView('dashboard')}
            className={isMobile ? 'flex-1' : ''}
          >
            <Film className="h-4 w-4 mr-1.5" />
            My Videos
          </Button>
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
