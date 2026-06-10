import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reelService,
  type ReelJob,
  type ReelJobsParams,
  type SubmitReelRequest,
} from '@/services/reelService';

const KEYS = {
  jobs: (params?: ReelJobsParams) => ['reel-jobs', params] as const,
  job: (id: number) => ['reel-job', id] as const,
};

const ACTIVE_STATUSES = ['queued', 'processing', 'stitching'];

export function useReelJobs(params?: ReelJobsParams) {
  return useQuery({
    queryKey: KEYS.jobs(params),
    queryFn: () => reelService.listJobs(params),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.data.some((job: ReelJob) => ACTIVE_STATUSES.includes(job.status)) ? 5000 : false;
    },
  });
}

export function useReelJob(jobId: number | null) {
  return useQuery({
    queryKey: KEYS.job(jobId!),
    queryFn: () => reelService.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      return ACTIVE_STATUSES.includes(data.status) ? 5000 : false;
    },
  });
}

export function useSubmitReel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubmitReelRequest) => reelService.submitReel(request),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['reel-jobs'] });
      queryClient.setQueryData(KEYS.job(job.id), job);
    },
  });
}

export function useCancelReelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => reelService.cancelJob(jobId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['reel-jobs'] });
      queryClient.setQueryData(KEYS.job(job.id), job);
    },
  });
}
