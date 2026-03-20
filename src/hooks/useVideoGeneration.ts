import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  higgsFieldService,
  type VideoPreset,
  type VideoGenerationJob,
  type SubmitVideoRequest,
  type SelectVariantsRequest,
  type ListJobsParams,
} from '@/services/higgsFieldService';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const KEYS = {
  presets: ['video-presets'] as const,
  jobs: (params?: ListJobsParams) => ['video-jobs', params] as const,
  job: (id: number) => ['video-job', id] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useVideoPresets() {
  return useQuery({
    queryKey: KEYS.presets,
    queryFn: () => higgsFieldService.getPresets(),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useVideoJobs(params?: ListJobsParams) {
  return useQuery({
    queryKey: KEYS.jobs(params),
    queryFn: () => higgsFieldService.listJobs(params),
    refetchInterval: (query) => {
      // Poll every 5s if any job is active
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.data.some((job: VideoGenerationJob) =>
        ['pending', 'converting_aspect', 'awaiting_approval', 'generating'].includes(job.status)
      );
      return hasActive ? 5000 : false;
    },
  });
}

export function useVideoJobStatus(jobId: number | null) {
  return useQuery({
    queryKey: KEYS.job(jobId!),
    queryFn: () => higgsFieldService.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      const isActive = ['pending', 'converting_aspect', 'generating'].includes(data.status);
      return isActive ? 5000 : false;
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useSubmitVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubmitVideoRequest) => higgsFieldService.submitVideoGeneration(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
    },
  });
}

export function useSelectVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, selections }: { jobId: number; selections: SelectVariantsRequest }) =>
      higgsFieldService.selectVariants(jobId, selections),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
      queryClient.setQueryData(KEYS.job(data.id), data);
    },
  });
}

export function useRegenerateVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => higgsFieldService.regenerateVariants(jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
      queryClient.setQueryData(KEYS.job(data.id), data);
    },
  });
}

export function useCancelVideoJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => higgsFieldService.cancelJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
    },
  });
}

// ─── Preset Admin Mutations ──────────────────────────────────────────────────

export function useCreatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<VideoPreset>) => higgsFieldService.createPreset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.presets });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VideoPreset> }) =>
      higgsFieldService.updatePreset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.presets });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => higgsFieldService.deletePreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.presets });
    },
  });
}
