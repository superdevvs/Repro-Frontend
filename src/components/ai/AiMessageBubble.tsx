import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { AiMessage } from '@/types/ai';

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
        {isAssistant && metadata.action && (
          <div className="flex items-center gap-2 mt-2">
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






