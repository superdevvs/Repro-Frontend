import React, { useState } from 'react';
import { Calendar as CalendarIcon, Eye, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

// Editor job interface - this would match your backend structure
export interface EditorJob {
  id: string;
  shootId: string;
  client?: {
    name: string;
    email?: string;
  };
  type: 'photo_edit' | 'video_edit' | 'floorplan' | 'other';
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

export function EditorJobsTable({ jobs }: EditorJobsTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
      'photo_edit': 'Photo Edit',
      'video_edit': 'Video Edit',
      'floorplan': 'Floorplan',
      'other': 'Other',
    };
    return typeMap[type] || type;
  };

  const handleViewJob = (job: EditorJob) => {
    // Navigate to shoot details or editor view
    navigate(`/shoots/${job.shootId}`);
  };

  const handleOpenEditor = (job: EditorJob) => {
    // Open editor interface for this job
    toast({
      title: "Opening Editor",
      description: `Opening editor for job #${job.id}`,
    });
    // Would navigate to editor interface
  };

  const filteredJobs = jobs; // Could add filtering by status if needed

  return (
    <div className="w-full">
      <Card className="mb-6">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-lg font-semibold">Editing Jobs</h3>
          <div className="flex gap-1 ml-4 text-xs">
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              aria-label="List view" 
              onClick={() => setViewMode('list')}
            >
              List View
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              aria-label="Grid view" 
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </Button>
          </div>
        </div>

        <div>
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 px-2 text-left">Job ID</th>
                    <th className="py-1 px-2 text-left">Shoot ID</th>
                    <th className="py-1 px-2 text-left">Client</th>
                    <th className="py-1 px-2 text-left">Type</th>
                    <th className="py-1 px-2 text-left">Status</th>
                    <th className="py-1 px-2 text-left">Pay</th>
                    <th className="py-1 px-2 text-left">Assigned Date</th>
                    <th className="py-1 px-2 text-left">Completed Date</th>
                    <th className="py-1 px-2 text-left">Payout Status</th>
                    <th className="py-1 px-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/30 transition">
                      <td className="py-1 px-2 font-medium text-xs">#{job.id}</td>
                      <td className="py-1 px-2 text-xs">#{job.shootId}</td>
                      <td className="py-1 px-2 text-xs">{job.client?.name || 'N/A'}</td>
                      <td className="py-1 px-2 text-xs">{getTypeLabel(job.type)}</td>
                      <td className="py-1 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(job.status)}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-xs font-medium">${(job.pay || job.payAmount || 0).toLocaleString()}</td>
                      <td className="py-1 px-2 text-xs">
                        {job.assignedDate ? format(new Date(job.assignedDate), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="py-1 px-2 text-xs">
                        {job.completedDate ? format(new Date(job.completedDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="py-1 px-2">
                        {job.payoutStatus ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPayoutStatusColor(job.payoutStatus)}`}>
                            {job.payoutStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2">
                        <div className="flex flex-wrap gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewJob(job)} 
                            aria-label="View Job" 
                            className="px-3 py-1 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
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
                              <Edit className="h-3 w-3 mr-1" />
                              Open Editor
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-muted-foreground text-sm">
                        No editing jobs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)]">
              <div className="space-y-3 p-3">
                {filteredJobs.map((job) => (
                  <JobItem 
                    key={job.id} 
                    job={job}
                    onView={handleViewJob}
                    onOpenEditor={handleOpenEditor}
                    getStatusColor={getStatusColor}
                    getPayoutStatusColor={getPayoutStatusColor}
                    getTypeLabel={getTypeLabel}
                  />
                ))}
                {filteredJobs.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">No editing jobs found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>
    </div>
  );
}

interface JobItemProps {
  job: EditorJob;
  onView: (job: EditorJob) => void;
  onOpenEditor: (job: EditorJob) => void;
  getStatusColor: (status: string) => string;
  getPayoutStatusColor: (status?: string) => string;
  getTypeLabel: (type: string) => string;
}

function JobItem({ 
  job, 
  onView,
  onOpenEditor,
  getStatusColor,
  getPayoutStatusColor,
  getTypeLabel,
}: JobItemProps) {
  return (
    <div className="flex flex-col bg-card rounded-lg shadow-sm">
      <div className="p-3 flex-row justify-between items-center border-b border-border hidden sm:flex">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-medium text-sm">Job #{job.id}</h3>
            <div className="text-xs text-muted-foreground">
              Shoot #{job.shootId} • {job.client?.name || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Type: {getTypeLabel(job.type)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Badge className={getStatusColor(job.status)}>
            {job.status.replace('_', ' ')}
          </Badge>
          <div className="text-right">
            <div className="font-medium">${(job.pay || job.payAmount || 0).toLocaleString()}</div>
            <div className="text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              <span>
                {job.assignedDate ? format(new Date(job.assignedDate), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
            {job.payoutStatus && (
              <Badge className={`mt-1 ${getPayoutStatusColor(job.payoutStatus)}`}>
                {job.payoutStatus}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 flex-row justify-between items-center border-b border-border flex sm:hidden">
        <div className="space-y-1">
          <h3 className="font-medium text-sm">Job #{job.id}</h3>
          <div className="text-xs text-muted-foreground">
            Shoot #{job.shootId} • {job.client?.name || 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">
            {getTypeLabel(job.type)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getStatusColor(job.status)}>
              {job.status.replace('_', ' ')}
            </Badge>
            <div className="text-xs font-medium">${(job.pay || job.payAmount || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="p-3 flex justify-between items-center">
        <div className="flex flex-wrap gap-2 text-xs">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView(job)}
            className="px-3 py-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          {job.status === 'in_progress' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenEditor(job)}
              className="px-3 py-1"
            >
              <Edit className="h-3 w-3 mr-1" />
              Open Editor
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


