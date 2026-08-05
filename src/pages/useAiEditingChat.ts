import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { autoenhanceService } from '@/services/autoenhanceService';
import { sendAiMessage } from '@/services/aiService';
import type { AiChatRequest, AiMessage } from '@/types/ai';
import type { useToast } from '@/hooks/use-toast';
import {
  getApiErrorMessage,
  isRecord,
  type AttachedImage,
  type ViewMode,
  type WorkspaceMode,
} from './aiEditingModel';

type Toast = ReturnType<typeof useToast>['toast'];

interface UseAiEditingChatOptions {
  jobShootFilter: string;
  loadJobs: (showLoader?: boolean) => Promise<void>;
  setJobShootFilter: Dispatch<SetStateAction<string>>;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  setWorkspaceMode: Dispatch<SetStateAction<WorkspaceMode>>;
  toast: Toast;
  viewMode: ViewMode;
}

interface EditingChatContext extends NonNullable<AiChatRequest['context']> {
  staged_ids?: string[];
}

export function useAiEditingChat({
  jobShootFilter,
  loadJobs,
  setJobShootFilter,
  setViewMode,
  setWorkspaceMode,
  toast,
  viewMode,
}: UseAiEditingChatOptions) {
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    attachedImagesRef.current = attachedImages;
  }, [attachedImages]);

  const submitChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatSending) return;

      setWorkspaceMode('chat');
      setViewMode('chat');
      setChatSending(true);
      setChatSuggestions([]);

      const optimisticUser: AiMessage = {
        id: `tmp-${Date.now()}`,
        sender: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((previous) => [...previous, optimisticUser]);

      try {
        const context: EditingChatContext = {
          page: 'ai_editing',
          intent: chatSessionId ? undefined : 'edit_photos',
        };
        const response = await sendAiMessage({
          sessionId: chatSessionId,
          message: trimmed,
          context,
        });

        setChatSessionId(response.sessionId);
        if (Array.isArray(response.messages)) setChatMessages(response.messages);
        setChatSuggestions(response.meta?.suggestions ?? []);
      } catch (error: unknown) {
        const detail = getApiErrorMessage(
          error,
          'Failed to reach Robbie. Try again in a moment.',
          ['error'],
        );
        toast({ title: 'Chat error', description: detail, variant: 'destructive' });
        setChatMessages((previous) => [
          ...previous,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            content: detail,
            createdAt: new Date().toISOString(),
            metadata: { type: 'error', tool_status: 'error' },
          },
        ]);
      } finally {
        setChatSending(false);
      }
    },
    [chatSending, chatSessionId, setViewMode, setWorkspaceMode, toast],
  );

  const openChatWithPrefill = useCallback(
    (prefill: string, options?: { send?: boolean }) => {
      if (options?.send) {
        void submitChatMessage(prefill);
        return;
      }
      setWorkspaceMode('chat');
      setViewMode('chat');
      setJobShootFilter(prefill);
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('input[data-ai-editing-prompt]');
        input?.focus();
        if (input && typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 30);
    },
    [setJobShootFilter, setViewMode, setWorkspaceMode, submitChatMessage],
  );

  const resetChat = useCallback(() => {
    setChatMessages([]);
    setChatSessionId(null);
    setChatSuggestions([]);
    setJobShootFilter('');
    setAttachedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    setWorkspaceMode('photo');
    setViewMode('activity');
  }, [setJobShootFilter, setViewMode, setWorkspaceMode]);

  const triggerImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImagesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const accepted: AttachedImage[] = [];
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      });
      if (accepted.length === 0) {
        toast({
          title: 'No images selected',
          description: 'Please pick image files (JPG, PNG, HEIC, WebP, TIFF, etc).',
          variant: 'destructive',
        });
        return;
      }
      setAttachedImages((current) => [...current, ...accepted]);
    },
    [toast],
  );

  const removeAttachedImage = useCallback((id: string) => {
    setAttachedImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  }, []);

  const clearAttachedImages = useCallback(() => {
    setAttachedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  useEffect(() => () => {
    attachedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const submitDraftWithAttachments = useCallback(async () => {
    const draft = jobShootFilter.trim();
    const images = attachedImages;
    if (!draft && images.length === 0) return;

    setJobShootFilter('');
    setAttachedImages([]);

    if (images.length === 0) {
      if (draft) await submitChatMessage(draft);
      return;
    }

    setWorkspaceMode('chat');
    setViewMode('chat');

    const summary = images.length === 1
      ? 'Uploading 1 image for AI editing…'
      : `Uploading ${images.length} images for AI editing…`;
    const fileList = images.map((image) => `• ${image.file.name}`).join('\n');
    const optimisticUserMessage: AiMessage = {
      id: `tmp-upload-${Date.now()}`,
      sender: 'user',
      content: `${summary}\n${fileList}${draft ? `\n\n${draft}` : ''}`,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((previous) => [...previous, optimisticUserMessage]);
    setChatSending(true);

    try {
      const stageResponse = await autoenhanceService.stageImages(images.map((image) => image.file));
      const staged = stageResponse.staged ?? [];
      const skipped = stageResponse.skipped ?? [];

      if (staged.length === 0) {
        const firstSkipped: unknown = skipped[0];
        const reason = isRecord(firstSkipped) && typeof firstSkipped.reason === 'string'
          ? firstSkipped.reason
          : 'unknown error';
        setChatMessages((previous) => [
          ...previous,
          {
            id: `stage-err-${Date.now()}`,
            sender: 'assistant',
            content: `I couldn't stage those uploads: ${reason}`,
            createdAt: new Date().toISOString(),
            metadata: { type: 'stage_error', tool_status: 'error' },
          },
        ]);
        toast({ title: 'Upload failed', description: reason, variant: 'destructive' });
        return;
      }

      const context: EditingChatContext = {
        page: 'ai_editing',
        intent: chatSessionId ? undefined : 'edit_photos',
        staged_ids: staged.map((item) => item.id),
      };
      const message = draft
        || `I uploaded ${staged.length} image${staged.length === 1 ? '' : 's'} — please edit them.`;
      const response = await sendAiMessage({ sessionId: chatSessionId, message, context });

      setChatSessionId(response.sessionId);
      if (Array.isArray(response.messages)) setChatMessages(response.messages);
      setChatSuggestions(response.meta?.suggestions ?? []);

      if (skipped.length > 0) {
        const firstSkipped: unknown = skipped[0];
        const description = isRecord(firstSkipped) && typeof firstSkipped.reason === 'string'
          ? firstSkipped.reason
          : 'See chat for details.';
        toast({
          title: `${skipped.length} file${skipped.length === 1 ? '' : 's'} skipped`,
          description,
        });
      }
    } catch (error: unknown) {
      const detail = getApiErrorMessage(error, 'Failed to upload images.', ['message', 'error']);
      setChatMessages((previous) => [
        ...previous,
        {
          id: `stage-err-${Date.now()}`,
          sender: 'assistant',
          content: `I couldn't upload those images: ${detail}`,
          createdAt: new Date().toISOString(),
          metadata: { type: 'stage_error', tool_status: 'error' },
        },
      ]);
      toast({ title: 'Upload failed', description: detail, variant: 'destructive' });
    } finally {
      setChatSending(false);
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    }
  }, [
    attachedImages,
    chatSessionId,
    jobShootFilter,
    setJobShootFilter,
    setViewMode,
    setWorkspaceMode,
    submitChatMessage,
    toast,
  ]);

  useEffect(() => {
    if (viewMode !== 'chat') return;
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, viewMode]);

  const lastJobsRefreshKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const last = chatMessages[chatMessages.length - 1];
    if (last.sender !== 'assistant') return;
    const metadata: unknown = last.metadata;
    if (!isRecord(metadata)) return;
    const actions = metadata.actions;
    const hasJobsAction = Array.isArray(actions)
      && actions.some((action) => isRecord(action) && action.type === 'view_editing_jobs');
    const isSuccess = metadata.tool_status === 'success';
    if (!hasJobsAction && !isSuccess) return;
    const key = `${last.id}-${last.createdAt}`;
    if (lastJobsRefreshKeyRef.current === key) return;
    lastJobsRefreshKeyRef.current = key;
    void loadJobs(false);
  }, [chatMessages, loadJobs]);

  return {
    attachedImages,
    chatMessages,
    chatScrollRef: chatScrollRef as RefObject<HTMLDivElement>,
    chatSending,
    chatSessionId,
    chatSuggestions,
    clearAttachedImages,
    fileInputRef: fileInputRef as RefObject<HTMLInputElement>,
    handleImagesSelected,
    openChatWithPrefill,
    removeAttachedImage,
    resetChat,
    setChatMessages,
    setChatSessionId,
    setChatSuggestions,
    submitChatMessage,
    submitDraftWithAttachments,
    triggerImagePicker,
  };
}
