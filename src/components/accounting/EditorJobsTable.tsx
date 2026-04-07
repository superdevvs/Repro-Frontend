import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Edit, Eye, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface EditorJob {
  id: string;
  shootId: string;
  client?: {
    name: string;
    email?: string;
  };
  type: string;
  typeLabel?: string;
  status: 'in_progress' | 'delivered' | 'approved' | 'pending' | 'rejected';
  pay: number;
  payAmount?: number;
  assignedDate: string;
  completedDate?: string;
  payoutStatus?: 'pending' | 'paid' | 'unpaid';
  editorId?: string;
  editor_id?: string;
}

interface EditorJobsTableProps {
  jobs: EditorJob[];
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages] as const;
};

const formatJobDate = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'MMM d, yyyy');
};

const getJobPay = (job: EditorJob) => job.pay || job.payAmount || 0;

export function EditorJobsTable({ jobs }: EditorJobsTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState(1);

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'approved' || statusLower === 'delivered') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (statusLower === 'in_progress' || statusLower === 'pending') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    if (statusLower === 'rejected') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getPayoutStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (statusLower === 'pending') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      photo_edit: 'Photo Edit',
      video_edit: 'Video Edit',
      floorplan: 'Floorplan',
      other: 'Other',
    };
    return typeMap[type] || type;
  };

  const handleViewJob = (job: EditorJob) => {
    navigate(`/shoots/${job.shootId}`);
  };

  const handleOpenEditor = (job: EditorJob) => {
    toast({
      title: 'Opening Editor',
      description: `Opening editor for job #${job.id}`,
    });
  };

  const filteredJobs = jobs;
  const itemsPerPage = viewMode === 'list' ? 12 : 9;
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + itemsPerPage);
  const paginationItems = buildPaginationItems(safePage, totalPages);

  const { showingFrom, showingTo } = useMemo(() => {
    if (filteredJobs.length === 0) {
      return { showingFrom: 0, showingTo: 0 };
    }

    return {
      showingFrom: startIndex + 1,
      showingTo: Math.min(startIndex + paginatedJobs.length, filteredJobs.length),
    };
  }, [filteredJobs.length, paginatedJobs.length, startIndex]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="w-full">
      <Card className="mb-6 overflow-hidden">
        <div className="border-b p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Editing Jobs</h3>
            <div className="flex items-center gap-1 text-xs">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                aria-label="List view"
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
              >
                List View
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                aria-label="Grid view"
                className="h-8 px-3"
                onClick={() => setViewMode('grid')}
              >
                Grid View
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Showing {showingFrom}-{showingTo} of {filteredJobs.length} jobs
            </p>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'list' ? 'Table view for quick scanning' : 'Card view for richer job details'}
            </p>
          </div>
        </div>

        <div>
          {filteredJobs.length === 0 ? (
            <EmptyJobsState />
          ) : viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">Job ID</th>
                    <th className="px-3 py-2 text-left">Shoot ID</th>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Pay</th>
                    <th className="px-3 py-2 text-left">Assigned Date</th>
                    <th className="px-3 py-2 text-left">Completed Date</th>
                    <th className="px-3 py-2 text-left">Payout Status</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedJobs.map((job) => (
                    <tr key={job.id} className="border-b transition hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium text-xs">#{job.id}</td>
                      <td className="px-3 py-2 text-xs">#{job.shootId}</td>
                      <td className="px-3 py-2 text-xs">{job.client?.name || 'N/A'}</td>
                      <td className="px-3 py-2 text-xs">{job.typeLabel || getTypeLabel(job.type)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getStatusColor(job.status)}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-medium">{usdFormatter.format(getJobPay(job))}</td>
                      <td className="px-3 py-2 text-xs">{formatJobDate(job.assignedDate)}</td>
                      <td className="px-3 py-2 text-xs">{formatJobDate(job.completedDate)}</td>
                      <td className="px-3 py-2">
                        {job.payoutStatus ? (
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getPayoutStatusColor(job.payoutStatus)}`}>
                            {job.payoutStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewJob(job)}
                            aria-label="View Job"
                            className="px-3 py-1 text-xs"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          {job.status === 'in_progress' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditor(job)}
                              aria-label="Open Editor"
                              className="px-3 py-1 text-xs"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              Open Editor
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedJobs.map((job) => (
                  <EditorJobCard
                    key={job.id}
                    job={job}
                    onView={handleViewJob}
                    onOpenEditor={handleOpenEditor}
                    getStatusColor={getStatusColor}
                    getPayoutStatusColor={getPayoutStatusColor}
                    getTypeLabel={getTypeLabel}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {filteredJobs.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Page {safePage} of {totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={safePage === 1 ? 'pointer-events-none opacity-40' : ''}
                  onClick={(event) => {
                    event.preventDefault();
                    handlePageChange(safePage - 1);
                  }}
                />
              </PaginationItem>

              {paginationItems.map((item, index) => (
                item === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      isActive={item === safePage}
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={safePage === totalPages ? 'pointer-events-none opacity-40' : ''}
                  onClick={(event) => {
                    event.preventDefault();
                    handlePageChange(safePage + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

interface EditorJobCardProps {
  job: EditorJob;
  onView: (job: EditorJob) => void;
  onOpenEditor: (job: EditorJob) => void;
  getStatusColor: (status: string) => string;
  getPayoutStatusColor: (status?: string) => string;
  getTypeLabel: (type: string) => string;
}

function EditorJobCard({
  job,
  onView,
  onOpenEditor,
  getStatusColor,
  getPayoutStatusColor,
  getTypeLabel,
}: EditorJobCardProps) {
  const pay = usdFormatter.format(getJobPay(job));

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-gradient-to-b from-background via-background to-muted/30 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Editing Job</p>
            <h3 className="truncate text-lg font-semibold text-foreground" title={`#${job.id}`}>
              #{job.id}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">Shoot #{job.shootId}</p>
          </div>
          <Badge className={cn('capitalize', getStatusColor(job.status))}>
            {job.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="truncate font-medium text-foreground" title={job.client?.name || 'N/A'}>
              {job.client?.name || 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium text-foreground">{job.typeLabel || getTypeLabel(job.type)}</p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pay</p>
            <p className="text-lg font-semibold text-foreground">{pay}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="flex items-center gap-1 font-medium text-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatJobDate(job.assignedDate)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="font-medium text-foreground">{formatJobDate(job.completedDate)}</p>
          </div>

          <div className="col-span-2 flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Payout</span>
            </div>
            {job.payoutStatus ? (
              <Badge className={cn('capitalize', getPayoutStatusColor(job.payoutStatus))}>
                {job.payoutStatus}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onView(job)}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          View
        </Button>
        {job.status === 'in_progress' && (
          <Button variant="outline" size="sm" onClick={() => onOpenEditor(job)}>
            <Edit className="mr-1 h-3.5 w-3.5" />
            Open Editor
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyJobsState() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-muted-foreground">No editing jobs found</p>
    </div>
  );
}
