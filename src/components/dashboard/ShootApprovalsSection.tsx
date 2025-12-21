import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileCheck, Clock, ArrowRight, MapPin } from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ShootApprovalsSectionProps {
  shoots: ShootData[];
}

export function ShootApprovalsSection({ shoots }: ShootApprovalsSectionProps) {
  const navigate = useNavigate();

  // Get shoots pending approval
  const pendingApprovals = shoots.filter(shoot => 
    shoot.workflowStatus === 'editing_complete' || 
    shoot.workflowStatus === 'pending_review'
  ).slice(0, 5);

  if (pendingApprovals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              <CardTitle>Pending Approvals</CardTitle>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              All Clear
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No shoots pending approval</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-amber-500" />
            <CardTitle>Pending Approvals</CardTitle>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              {pendingApprovals.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/shoots?filter=pending_approval')}
          >
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingApprovals.map((shoot, index) => (
            <motion.div
              key={shoot.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => navigate(`/shoots?id=${shoot.id}`)}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={shoot.photographer?.avatar} />
                <AvatarFallback>
                  {shoot.photographer?.name?.charAt(0) || 'P'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="font-medium text-sm truncate">
                    {shoot.location.address}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'MMM dd') : 'TBD'}
                  </span>
                  <span>•</span>
                  <span>{shoot.client.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                >
                  Review
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

