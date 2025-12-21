import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, MoreVertical, Copy, Edit, Trash2, Send, Eye } from 'lucide-react';
import { getTemplates, deleteTemplate, duplicateTemplate } from '@/services/messaging';
import { TemplateEditorDialog } from '@/components/messaging/templates/TemplateEditorDialog';
import type { MessageTemplate } from '@/types/messaging';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Templates() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', 'EMAIL', selectedScope === 'all' ? undefined : selectedScope],
    queryFn: () =>
      getTemplates({
        channel: 'EMAIL',
        scope: selectedScope === 'all' ? undefined : selectedScope,
      }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success('Template deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete template');
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => {
      toast.success('Template duplicated successfully');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to duplicate template');
    },
  });

  const filteredTemplates = templates?.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDelete = (template: MessageTemplate) => {
    if (template.is_system) {
      toast.error('Cannot delete system template');
      return;
    }

    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteMutation.mutate(template.id);
    }
  };

  const categoryColors = {
    BOOKING: 'bg-blue-100 text-blue-800',
    REMINDER: 'bg-yellow-100 text-yellow-800',
    PAYMENT: 'bg-green-100 text-green-800',
    INVOICE: 'bg-purple-100 text-purple-800',
    ACCOUNT: 'bg-pink-100 text-pink-800',
    GENERAL: 'bg-gray-100 text-gray-800',
  };

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="container mx-auto py-6">
        {/* Header */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Email Templates</h1>
              <p className="text-muted-foreground">
                Manage booking confirmations, reminders, and custom email layouts
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedScope} onValueChange={setSelectedScope}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="SYSTEM">System</TabsTrigger>
            <TabsTrigger value="GLOBAL">Global</TabsTrigger>
            <TabsTrigger value="USER">My Templates</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedScope} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                    <div className="h-3 bg-muted rounded w-full mb-2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </Card>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No templates found</p>
                <Button onClick={() => setIsCreating(true)} className="mt-4">
                  Create your first template
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="p-6 hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingTemplate(template)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditingTemplate(template);
                      }
                    }}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(template.id)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            {!template.is_system && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(template)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Badges */}
                      <div className="flex gap-2 flex-wrap">
                        {template.category && (
                          <Badge className={categoryColors[template.category]}>
                            {template.category}
                          </Badge>
                        )}
                        {template.scope && (
                          <Badge variant="outline">{template.scope}</Badge>
                        )}
                        {template.is_system && (
                          <Badge variant="secondary">System</Badge>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="text-xs text-muted-foreground">
                        Last updated: {new Date(template.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Template Editor Dialog */}
        {(isCreating || editingTemplate) && (
          <TemplateEditorDialog
            template={editingTemplate}
            open={true}
            onClose={() => {
              setIsCreating(false);
              setEditingTemplate(null);
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['templates'] });
              setIsCreating(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

