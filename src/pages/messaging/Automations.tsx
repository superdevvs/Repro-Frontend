import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, MoreVertical, Edit, Trash2, Play, Zap, CheckCircle, XCircle } from 'lucide-react';
import { getAutomations, deleteAutomation, toggleAutomation } from '@/services/messaging';
import { AutomationEditorDialog } from '@/components/messaging/automations/AutomationEditorDialog';
import type { AutomationRule } from '@/types/messaging';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const triggerLabels: Record<string, string> = {
  ACCOUNT_CREATED: 'Account Created',
  ACCOUNT_VERIFIED: 'Account Verified',
  SHOOT_BOOKED: 'Shoot Booked',
  SHOOT_SCHEDULED: 'Shoot Scheduled',
  SHOOT_REMINDER: 'Shoot Reminder',
  SHOOT_COMPLETED: 'Shoot Completed',
  PAYMENT_COMPLETED: 'Payment Completed',
  INVOICE_SUMMARY: 'Invoice Summary',
  WEEKLY_PHOTOGRAPHER_INVOICE: 'Weekly Photographer Invoice',
  WEEKLY_REP_INVOICE: 'Weekly Rep Invoice',
  WEEKLY_SALES_REPORT: 'Weekly Sales Report',
  WEEKLY_AUTOMATED_INVOICING: 'Weekly Automated Invoicing',
  PHOTO_UPLOADED: 'Photo Uploaded',
  PROPERTY_CONTACT_REMINDER: 'Property Contact Reminder',
};

export default function Automations() {
  const queryClient = useQueryClient();
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch automations
  const { data: automations, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => getAutomations(),
    onSuccess: (data) => {
      // Debug: Log automations to console
      console.log('Automations fetched:', data);
      console.log('System automations:', data?.filter((a) => a.scope === 'SYSTEM'));
      console.log('Weekly automations:', data?.filter((a) => 
        a.trigger_type === 'WEEKLY_SALES_REPORT' || a.trigger_type === 'WEEKLY_AUTOMATED_INVOICING'
      ));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      toast.success('Automation deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete automation');
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: toggleAutomation,
    onSuccess: (data) => {
      toast.success(data.is_active ? 'Automation enabled' : 'Automation disabled');
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to toggle automation');
    },
  });

  const handleDelete = (automation: AutomationRule) => {
    if (automation.scope === 'SYSTEM') {
      toast.error('Cannot delete system automation');
      return;
    }

    if (confirm(`Are you sure you want to delete "${automation.name}"?`)) {
      deleteMutation.mutate(automation.id);
    }
  };

  const systemAutomations = automations?.filter((a) => a.scope === 'SYSTEM') || [];
  const customAutomations = automations?.filter((a) => a.scope !== 'SYSTEM') || [];
  
  // Debug: Check for weekly automations specifically
  const weeklyAutomations = automations?.filter((a) => 
    a.trigger_type === 'WEEKLY_SALES_REPORT' || a.trigger_type === 'WEEKLY_AUTOMATED_INVOICING'
  ) || [];

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="container mx-auto py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Automation Rules</h1>
              <p className="text-muted-foreground">
                Automate emails based on shoot, payment, and account events
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Automation
            </Button>
          </div>
        </div>

        {/* Debug Info - Remove in production */}
        {import.meta.env.DEV && automations && (
          <Card className="p-4 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Debug:</strong> Total: {automations.length} | 
              System: {systemAutomations.length} | 
              Weekly: {weeklyAutomations.length} | 
              Custom: {customAutomations.length}
            </p>
            {weeklyAutomations.length === 0 && automations.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                ⚠️ Weekly automations not found in response. Check console for details.
              </p>
            )}
          </Card>
        )}

        {/* System Automations */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Required System Automations
          </h2>
          {isLoading ? (
            <Card className="p-6">
              <p className="text-muted-foreground">Loading automations...</p>
            </Card>
          ) : systemAutomations.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground">No system automations found</p>
              {automations && automations.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Found {automations.length} total automations, but none with scope='SYSTEM'
                </p>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {systemAutomations.map((automation) => (
              <Card key={automation.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{automation.name}</h3>
                      <Badge variant="secondary">System</Badge>
                      {automation.is_active ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{automation.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Trigger: {triggerLabels[automation.trigger_type] || automation.trigger_type}</span>
                      {automation.template && <span>Template: {automation.template.name}</span>}
                      {automation.schedule_json && (
                        <span>
                          Schedule: {automation.schedule_json.type === 'weekly' 
                            ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][automation.schedule_json.day_of_week - 1]} at ${automation.schedule_json.time}`
                            : 'Custom'}
                        </span>
                      )}
                      {automation.recipients_json && automation.recipients_json.roles && (
                        <span>Recipients: {automation.recipients_json.roles.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={() => toggleMutation.mutate(automation.id)}
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAutomation(automation)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
              ))}
            </div>
          )}
        </div>

        {/* Custom Automations */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Custom Automations</h2>
          {customAutomations.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No custom automations yet</p>
              <Button onClick={() => setIsCreating(true)} className="mt-4">
                Create your first automation
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {customAutomations.map((automation) => (
                <Card key={automation.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{automation.name}</h3>
                        {automation.is_active ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{automation.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Trigger: {triggerLabels[automation.trigger_type]}</span>
                        {automation.template && <span>Template: {automation.template.name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={() => toggleMutation.mutate(automation.id)}
                      />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingAutomation(automation)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(automation)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Automation Editor Dialog */}
        {(isCreating || editingAutomation) && (
          <AutomationEditorDialog
            automation={editingAutomation}
            open={true}
            onClose={() => {
              setIsCreating(false);
              setEditingAutomation(null);
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['automations'] });
              setIsCreating(false);
              setEditingAutomation(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

