import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, CheckCircle, Eye, Archive, Clock, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import EnhancedFileUpload from "@/components/EnhancedFileUpload";
import axios from 'axios';

interface WorkflowFile {
  id: number;
  filename: string;
  workflow_stage: string;
  file_size: number;
  uploaded_at: string;
  moved_to_completed_at?: string;
  verified_at?: string;
  verification_notes?: string;
}

interface WorkflowLog {
  id: number;
  action: string;
  details: string;
  created_at: string;
  user: {
    name: string;
    role: string;
  };
}

interface WorkflowStatus {
  shoot_id: number;
  workflow_status: string;
  file_stats: {
    total: number;
    todo: number;
    completed: number;
    verified: number;
  };
  workflow_logs: WorkflowLog[];
  can_upload_photos: boolean;
  can_move_to_completed: boolean;
  can_verify: boolean;
}

interface WorkflowDashboardProps {
  shootId: number;
  userRole: string;
}

const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({ shootId, userRole }) => {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchWorkflowStatus = async () => {
    try {
      const response = await axios.get(`/api/shoots/${shootId}/workflow-status`);
      setWorkflowStatus(response.data);
    } catch (error) {
      console.error('Error fetching workflow status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workflow status",
        variant: "destructive",
      });
    }
  };

  const fetchShootDetails = async () => {
    try {
      const response = await axios.get(`/api/shoots/${shootId}`);
      setFiles(response.data.data.files || []);
    } catch (error) {
      console.error('Error fetching shoot details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflowStatus();
    fetchShootDetails();
  }, [shootId]);



  const handleMoveToCompleted = async (fileId: number) => {
    try {
      await axios.post(`/api/shoots/${shootId}/files/${fileId}/move-to-completed`);
      toast({
        title: "Success",
        description: "File moved to completed folder",
      });
      fetchWorkflowStatus();
      fetchShootDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to move file",
        variant: "destructive",
      });
    }
  };

  const handleVerifyFile = async (fileId: number, notes?: string) => {
    try {
      await axios.post(`/api/shoots/${shootId}/files/${fileId}/verify`, {
        verification_notes: notes
      });
      toast({
        title: "Success",
        description: "File verified and moved to final storage",
      });
      fetchWorkflowStatus();
      fetchShootDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to verify file",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      booked: { label: 'Booked', variant: 'secondary' as const },
      photos_uploaded: { label: 'Photos Uploaded', variant: 'default' as const },
      editing_complete: { label: 'Editing Complete', variant: 'default' as const },
      admin_verified: { label: 'Admin Verified', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'default' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'todo': return <Upload className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'verified': return <Eye className="h-4 w-4" />;
      case 'archived': return <Archive className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading workflow status...</div>;
  }

  if (!workflowStatus) {
    return <div className="flex justify-center p-8">Failed to load workflow status</div>;
  }

  const progressPercentage = workflowStatus.file_stats.total > 0 
    ? (workflowStatus.file_stats.verified / workflowStatus.file_stats.total) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Workflow Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Workflow Status
            {getStatusBadge(workflowStatus.workflow_status)}
          </CardTitle>
          <CardDescription>
            Track the progress of your real estate photography workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{workflowStatus.file_stats.verified}/{workflowStatus.file_stats.total} files completed</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-orange-600">{workflowStatus.file_stats.todo}</div>
                <div className="text-sm text-muted-foreground">To Do</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">{workflowStatus.file_stats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{workflowStatus.file_stats.verified}</div>
                <div className="text-sm text-muted-foreground">Verified</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{workflowStatus.file_stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="files" className="w-full">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>
        
        <TabsContent value="files" className="space-y-4">
          {/* Enhanced File Upload Section */}
          {workflowStatus.can_upload_photos && (userRole === 'photographer' || userRole === 'admin') && (
            <EnhancedFileUpload 
              shootId={shootId} 
              onUploadComplete={() => {
                fetchWorkflowStatus();
                fetchShootDetails();
              }} 
            />
          )}

          {/* Files List */}
          <Card>
            <CardHeader>
              <CardTitle>Files ({files.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStageIcon(file.workflow_stage)}
                      <div>
                        <div className="font-medium">{file.filename}</div>
                        <div className="text-sm text-muted-foreground">
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB • {file.workflow_stage}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.workflow_stage === 'todo' && (userRole === 'photographer' || userRole === 'admin') && (
                        <Button
                          size="sm"
                          onClick={() => handleMoveToCompleted(file.id)}
                          variant="outline"
                        >
                          Move to Completed
                        </Button>
                      )}
                      
                      {file.workflow_stage === 'completed' && (userRole === 'admin') && (
                        <Button
                          size="sm"
                          onClick={() => handleVerifyFile(file.id)}
                          variant="outline"
                        >
                          Verify & Archive
                        </Button>
                      )}
                      
                      <Badge variant={
                        file.workflow_stage === 'verified' ? 'default' :
                        file.workflow_stage === 'completed' ? 'secondary' :
                        'outline'
                      }>
                        {file.workflow_stage}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {files.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No files uploaded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent workflow activities and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowStatus.workflow_logs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 border-l-2 border-blue-200">
                    <AlertCircle className="h-4 w-4 mt-1 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium">{log.details}</div>
                      <div className="text-sm text-muted-foreground">
                        by {log.user.name} • {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                
                {workflowStatus.workflow_logs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity logs yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowDashboard;
