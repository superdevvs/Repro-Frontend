import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { AiMessage } from '@/types/ai';
import { apiClient } from '@/services/api';
import { toast } from '@/components/ui/use-toast';

interface AiMessageBubbleProps {
  message: AiMessage;
  className?: string;
}

export function AiMessageBubble({ message, className }: AiMessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';
  const metadata = message.metadata || {};
  const toolCalls = metadata.tool_calls || [];
  const toolResults = metadata.tool_results || [];
  const actions = Array.isArray(metadata.actions) ? metadata.actions : [];
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    // Could add toast notification here
  };

  const handleApply = () => {
    // Handle apply action based on metadata
    if (metadata.action === 'apply_listing_changes') {
      // Trigger listing update
      console.log('Applying listing changes', metadata);
    }
  };

  const setLoadingFor = (key: string, value: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const handleAction = async (action: Record<string, any>) => {
    const actionKey = `${action.type}-${action.shootId ?? action.id ?? ''}`;
    setLoadingFor(actionKey, true);

    try {
      switch (action.type) {
        case 'open_shoot':
          if (action.shootId) {
            window.location.href = `/shoots/${action.shootId}`;
          }
          break;
        case 'approve_cancellation':
          if (action.shootId) {
            await apiClient.post(`/shoots/${action.shootId}/approve-cancellation`);
            toast({ title: 'Cancellation approved', description: `Shoot #${action.shootId} cancelled.` });
          }
          break;
        case 'reject_cancellation':
          if (action.shootId) {
            await apiClient.post(`/shoots/${action.shootId}/reject-cancellation`);
            toast({ title: 'Cancellation rejected', description: `Shoot #${action.shootId} kept active.` });
          }
          break;
        case 'create_checkout_link':
          if (action.shootId) {
            const response = await apiClient.post(`/shoots/${action.shootId}/create-checkout-link`);
            const checkoutUrl = response.data?.checkoutUrl;
            if (checkoutUrl) {
              window.open(checkoutUrl, '_blank');
            } else {
              throw new Error('No checkout URL returned');
            }
          }
          break;
        case 'pay_multiple_shoots':
          if (Array.isArray(action.shootIds) && action.shootIds.length > 0) {
            const response = await apiClient.post('/payments/multiple-shoots', {
              shoot_ids: action.shootIds,
            });
            const checkoutUrl = response.data?.checkoutUrl;
            if (checkoutUrl) {
              window.open(checkoutUrl, '_blank');
            } else {
              throw new Error('No checkout URL returned');
            }
          }
          break;
        case 'ready_for_review':
          if (action.shootId) {
            await apiClient.post(`/shoots/${action.shootId}/ready-for-review`);
            toast({ title: 'Marked ready', description: `Shoot #${action.shootId} is ready for review.` });
          }
          break;
        case 'assign_editor':
          if (action.shootId) {
            await apiClient.post(`/shoots/${action.shootId}/assign-editor`, {
              editor_id: action.editorId ?? null,
            });
            toast({ title: 'Editor assigned', description: `Shoot #${action.shootId} assigned to an editor.` });
          }
          break;
        default:
          console.warn('Unknown action type:', action.type);
      }
    } catch (error: any) {
      toast({
        title: 'Action failed',
        description: error?.response?.data?.message || error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingFor(actionKey, false);
    }
  };

  return (
    <div className={cn("flex", isUser ? 'justify-end' : 'justify-start', className)}>
      <div className={cn("max-w-[80%] flex flex-col gap-2")}>
        {/* Main message bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-2.5",
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>

        {/* Tool calls and results (for assistant messages) */}
        {isAssistant && toolCalls.length > 0 && (
          <div className="space-y-2">
            {toolCalls.map((toolCall: any, index: number) => {
              const toolResult = toolResults[index];
              return (
                <div
                  key={toolCall.id || index}
                  className="bg-muted/50 rounded-lg p-3 text-xs border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-muted-foreground">
                      {toolCall.function?.name || 'Tool call'}
                    </span>
                    {toolResult && (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        toolResult.success !== false
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      )}>
                        {toolResult.success !== false ? 'Success' : 'Error'}
                      </span>
                    )}
                  </div>
                  {toolResult && toolResult.message && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {toolResult.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons for assistant messages with specific actions */}
        {isAssistant && (metadata.action || actions.length > 0) && (
          <div className="flex items-center gap-2 mt-2">
            {actions.map((action: Record<string, any>, index: number) => {
              const actionKey = `${action.type}-${action.shootId ?? action.id ?? index}`;
              return (
                <Button
                  key={actionKey}
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(action)}
                  disabled={actionLoading[actionKey]}
                  className="h-8 text-xs"
                >
                  {actionLoading[actionKey] ? 'Working...' : (action.label ?? action.type)}
                </Button>
              );
            })}
            {metadata.action === 'apply_listing_changes' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApply}
                className="h-8 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Apply to Listing
              </Button>
            )}
            {metadata.shoot_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = `/shoots/${metadata.shoot_id}`}
                className="h-8 text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Shoot
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-8 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        )}

        {/* Timestamp */}
        <span className={cn(
          "text-xs text-muted-foreground px-1",
          isUser ? 'text-right' : 'text-left'
        )}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}






