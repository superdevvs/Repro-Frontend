import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth/AuthProvider';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { getAvatarUrl } from '@/utils/defaultAvatars';
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
  const toolStatus = metadata.tool_status as string | undefined;
  const actions = Array.isArray(metadata.actions) ? metadata.actions : [];
  const showToolStatus = isAssistant && Boolean(toolStatus);
  const toolStatusOk = showToolStatus ? toolStatus === 'success' : false;
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const userName = user?.name || user?.email?.split('@')[0] || 'You';
  const userAvatarUrl = user
    ? getAvatarUrl(user.avatar, user.role, (user as any).gender, user.id)
    : undefined;
  const userInitials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

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
    <div className={cn("flex w-full", isUser ? 'justify-end' : 'justify-start', className)}>
      <div
        className={cn(
          "flex items-end gap-2 md:gap-3",
          isUser ? "flex-row-reverse max-w-[85%]" : "flex-row max-w-[90%]"
        )}
      >
        {isAssistant && (
          <div className="flex-shrink-0">
            <svg 
              width="28" 
              height="28" 
              viewBox="0 0 87 87" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 md:w-9 md:h-9"
            >
              <path 
                d="M74.0137 30.8125V79.75H8.76367V30.8125L41.3887 7.25L74.0137 30.8125ZM40.0312 29.8799C38.5156 37.268 32.5833 42.9459 25.1357 44.1357L19.6387 45.0137L25.1357 45.8916C32.5832 47.0815 38.5155 52.7595 40.0312 60.1475L41.3887 66.7637L42.7461 60.1475C44.2618 52.7595 50.1942 47.0815 57.6416 45.8916L63.1387 45.0137L57.6416 44.1357C50.1941 42.9458 44.2618 37.2679 42.7461 29.8799L41.3887 23.2637L40.0312 29.8799ZM41.3887 40.0186C42.759 41.9179 44.4046 43.6014 46.2666 45.0137C44.4046 46.4259 42.759 48.1093 41.3887 50.0088C40.0182 48.1092 38.372 46.426 36.5098 45.0137C38.3721 43.6013 40.0182 41.9182 41.3887 40.0186Z" 
                fill="#3B82F6"
              />
            </svg>
          </div>
        )}
        {isUser && (
          <Avatar className="h-9 w-9">
            <AvatarImage src={userAvatarUrl} alt={userName} />
            <AvatarFallback className="text-[10px] font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        )}
        <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
          {/* Main message bubble */}
          <div
            className={cn(
              "w-fit max-w-[86vw] md:max-w-[620px] rounded-[34px] px-4 py-2.5 shadow-sm",
              isUser ? 'rounded-br-[12px]' : 'rounded-bl-[12px]',
              isUser
                ? 'bg-blue-500 text-white'
                : 'bg-blue-50 text-slate-900 border border-blue-100/80 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700/40'
            )}
          >
            <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full leading-relaxed">
              {message.content}
            </p>
          </div>

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
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs text-muted-foreground px-1",
              isUser ? 'text-right' : 'text-left'
            )}
          >
            {showToolStatus && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  toolStatusOk ? 'bg-green-500' : 'bg-red-500'
                )}
              />
            )}
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}






