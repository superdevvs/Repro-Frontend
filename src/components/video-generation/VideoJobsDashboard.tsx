import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Film,
} from 'lucide-react';
import { useVideoJobs, useCancelVideoJob } from '@/hooks/useVideoGeneration';
import { VideoPreviewDialog } from './VideoPreviewDialog';
import type { VideoGenerationJob } from '@/services/higgsFieldService';

interface VideoJobsDashboardProps {
  onViewJob: (jobId: number) => void;
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { variant: 'secondary', label: 'Queued' },
  converting_aspect: { variant: 'default', label: 'Converting' },
  awaiting_approval: { variant: 'outline', label: 'Awaiting Approval' },
  generating: { variant: 'default', label: 'Generating' },
  completed: { variant: 'default', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
};

export function VideoJobsDashboard({ onViewJob }: VideoJobsDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data: jobsData, isLoading } = useVideoJobs(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const cancelJob = useCancelVideoJob();

  const jobs = jobsData?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="w-24 h-16 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Videos</h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="generating">In Progress</SelectItem>
            <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs list */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Film className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">No videos generated yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: VideoGenerationJob) => {
            const badge = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
            const isActive = ['pending', 'converting_aspect', 'generating'].includes(job.status);

            return (
              <Card key={job.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                  {/* Thumbnail / play */}
                  <div
                    className="relative w-16 h-12 sm:w-24 sm:h-16 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      if (job.status === 'completed' && job.video_url) {
                        setPreviewUrl(job.video_url);
                      } else {
                        onViewJob(job.id);
                      }
                    }}
                  >
                    {job.video_thumbnail_url ? (
                      <img
                        src={job.video_thumbnail_url}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : job.original_start_frame_url ? (
                      <img
                        src={job.original_start_frame_url}
                        alt="Start frame"
                        className="w-full h-full object-cover opacity-60"
                      />
                    ) : null}

                    {job.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-6 w-6 text-white" fill="white" />
                      </div>
                    )}

                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {job.preset_name}
                      </p>
                      <Badge variant={badge.variant} className="text-[10px] flex-shrink-0">
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {job.aspect_ratio === 'horizontal' ? '16:9' : '9:16'} &middot;{' '}
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="hidden sm:flex gap-2 flex-shrink-0">
                    {job.status === 'awaiting_approval' && (
                      <Button size="sm" variant="outline" onClick={() => onViewJob(job.id)}>
                        Review
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelJob.mutate(job.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Cancel
                      </Button>
                    )}
                    {job.status === 'completed' && job.video_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={job.video_url} download target="_blank" rel="noopener noreferrer">
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <VideoPreviewDialog
        open={!!previewUrl}
        onOpenChange={(open) => !open && setPreviewUrl(null)}
        videoUrl={previewUrl}
      />
    </div>
  );
}
