import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listingVideoService,
  type ListingVideoJob,
  type ListingVideoJobsParams,
  type SubmitListingVideoRequest,
} from '@/services/listingVideoService';

const KEYS = {
  jobs: (params?: ListingVideoJobsParams) => ['listing-video-jobs', params] as const,
  job: (id: number) => ['listing-video-job', id] as const,
};

const ACTIVE_STATUSES = ['queued', 'processing', 'stitching'];

export function useListingVideoJobs(params?: ListingVideoJobsParams) {
  return useQuery({
    queryKey: KEYS.jobs(params),
    queryFn: () => listingVideoService.listJobs(params),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.data.some((job: ListingVideoJob) => ACTIVE_STATUSES.includes(job.status)) ? 5000 : false;
    },
  });
}

export function useListingVideoJob(jobId: number | null) {
  return useQuery({
    queryKey: KEYS.job(jobId!),
    queryFn: () => listingVideoService.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      return ACTIVE_STATUSES.includes(data.status) ? 5000 : false;
    },
  });
}

export function useSubmitListingVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubmitListingVideoRequest) => listingVideoService.submitListingVideo(request),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['listing-video-jobs'] });
      queryClient.setQueryData(KEYS.job(job.id), job);
    },
  });
}

export function useCancelListingVideoJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => listingVideoService.cancelJob(jobId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['listing-video-jobs'] });
      queryClient.setQueryData(KEYS.job(job.id), job);
    },
  });
}
