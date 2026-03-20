import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Download, RefreshCw, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VerticalVariantSelector } from './VerticalVariantSelector';
import { useVideoJobStatus, useSelectVariants, useRegenerateVariants } from '@/hooks/useVideoGeneration';
import type { VideoGenerationJob } from '@/services/higgsFieldService';

interface ProcessingViewProps {
  jobId: number;
  onCreateAnother: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Queued', color: 'bg-slate-500', icon: <Loader2 className="h-5 w-5 animate-spin" /> },
  converting_aspect: { label: 'Converting to Vertical', color: 'bg-blue-500', icon: <Loader2 className="h-5 w-5 animate-spin" /> },
  awaiting_approval: { label: 'Select Best Variants', color: 'bg-amber-500', icon: null },
  generating: { label: 'Generating Video', color: 'bg-blue-500', icon: <Loader2 className="h-5 w-5 animate-spin" /> },
  completed: { label: 'Complete', color: 'bg-green-500', icon: <CheckCircle2 className="h-5 w-5" /> },
  failed: { label: 'Failed', color: 'bg-red-500', icon: <XCircle className="h-5 w-5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500', icon: <XCircle className="h-5 w-5" /> },
};

export function ProcessingView({ jobId, onCreateAnother }: ProcessingViewProps) {
  const { toast } = useToast();
  const { data: job, isLoading } = useVideoJobStatus(jobId);
  const selectVariants = useSelectVariants();
  const regenerateVariants = useRegenerateVariants();

  const [selectedStartVariant, setSelectedStartVariant] = useState<number | null>(null);
  const [selectedEndVariant, setSelectedEndVariant] = useState<number | null>(null);

  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = job.status;

    if (!prev || prev === job.status) return;

    if (job.status === 'completed') {
      toast({ title: 'Video ready!', description: 'Your video has been generated successfully.' });
    } else if (job.status === 'failed') {
      toast({ title: 'Generation failed', description: job.error_message || 'An error occurred', variant: 'destructive' });
    } else if (job.status === 'awaiting_approval') {
      toast({ title: 'Variants ready', description: 'Please select the best vertical variants to continue.' });
    }
  }, [job?.status]);

  if (isLoading || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-500">Loading job status...</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;

  const handleApproveVariants = () => {
    if (!selectedStartVariant) return;
    selectVariants.mutate({
      jobId: job.id,
      selections: {
        start_frame_variant_id: selectedStartVariant,
        end_frame_variant_id: selectedEndVariant || undefined,
      },
    });
  };

  const handleRegenerate = () => {
    setSelectedStartVariant(null);
    setSelectedEndVariant(null);
    regenerateVariants.mutate(job.id);
  };

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full text-white ${statusConfig.color}`}>
          {statusConfig.icon || <CheckCircle2 className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {statusConfig.label}
          </h3>
          <p className="text-sm text-slate-500">
            {job.preset_name} &middot; {job.aspect_ratio === 'horizontal' ? '16:9' : '9:16'}
          </p>
        </div>
      </div>

      {/* Progress for active states */}
      {['pending', 'converting_aspect', 'generating'].includes(job.status) && (
        <div className="space-y-2">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{
                width:
                  job.status === 'pending'
                    ? '10%'
                    : job.status === 'converting_aspect'
                      ? '40%'
                      : '70%',
              }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center">
            {job.status === 'pending' && 'Waiting in queue...'}
            {job.status === 'converting_aspect' && 'Converting images to vertical format...'}
            {job.status === 'generating' && 'Generating video, this may take a few minutes...'}
          </p>
        </div>
      )}

      {/* Vertical variant selection */}
      {job.status === 'awaiting_approval' && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Choose the best vertical versions
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Select one variant for each frame. These will be used to generate your video.
              </p>
            </div>

            <VerticalVariantSelector
              label="Start Frame"
              originalImageUrl={job.original_start_frame_url}
              variants={job.start_frame_variants}
              selectedVariantId={selectedStartVariant}
              onSelect={setSelectedStartVariant}
            />

            {job.end_frame_variants.length > 0 && (
              <VerticalVariantSelector
                label="End Frame"
                originalImageUrl={job.original_end_frame_url || ''}
                variants={job.end_frame_variants}
                selectedVariantId={selectedEndVariant}
                onSelect={setSelectedEndVariant}
              />
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleApproveVariants}
                disabled={!selectedStartVariant || selectVariants.isPending}
                className="flex-1"
              >
                {selectVariants.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Continue with Selected
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerateVariants.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed - video player */}
      {job.status === 'completed' && job.video_url && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <video
              src={job.video_url}
              controls
              className="w-full aspect-video bg-black"
              poster={job.video_thumbnail_url || undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* Failed - error message */}
      {job.status === 'failed' && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {job.error_message || 'An error occurred during video generation'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons for terminal states */}
      {['completed', 'failed', 'cancelled'].includes(job.status) && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCreateAnother} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Create Another Video
          </Button>
          {job.status === 'completed' && job.video_url && (
            <Button asChild>
              <a href={job.video_url} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
