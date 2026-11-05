import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ImagePlus, RefreshCw, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { cn } from '@/lib/utils';
import { getBrokerageLogo, saveBrokerageLogo, validateBrokerageLogo } from '@/services/brokerageLogoService';

interface BrokerageLogoCardProps {
  userId: string | number;
  company?: string;
  variant?: 'editor' | 'summary';
  onEdit?: () => void;
  onChange?: (logo: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export function BrokerageLogoCard(props: BrokerageLogoCardProps) {
  const { user: viewer, role } = useAuth();
  const viewerKey = `${viewer?.id ?? ''}:${role}`;
  return <BrokerageLogoContent key={`${props.userId}:${viewerKey}`} {...props} viewerKey={viewerKey} />;
}

function BrokerageLogoContent({
  userId, company, variant = 'editor', onEdit, onChange, className, disabled = false,
  viewerKey,
}: BrokerageLogoCardProps & { viewerKey: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['brokerage-logo', String(userId), viewerKey];
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({
    queryKey,
    queryFn: () => getBrokerageLogo(userId),
    retry: false,
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (file: File | null) => saveBrokerageLogo(userId, file),
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: async (data, file) => {
      // A background profile refresh must not replace the newly saved preview.
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, data);
      onChange?.(data.logo);
      setStatus(file ? 'Brokerage logo saved.' : 'Brokerage logo removed.');
    },
    onError: (error) => {
      const forbidden = isAxiosError(error) && error.response?.status === 403;
      setError(forbidden ? 'You no longer have permission to change this logo.' : 'The logo could not be saved. Please try again.');
      if (forbidden) void queryClient.invalidateQueries({ queryKey });
    },
  });
  const canManage = query.data?.can_manage === true;
  const busy = mutation.isPending || query.isFetching || disabled;
  const logo = query.data?.logo;
  const save = (file: File | null) => {
    setError('');
    setStatus('');
    if (file) {
      const validationError = validateBrokerageLogo(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    mutation.mutate(file);
  };

  if (query.isLoading) {
    return <p className="flex items-center gap-2 text-xs text-muted-foreground"><InlineSpinner className="h-3 w-3" />Loading brokerage logo…</p>;
  }

  if (query.isError) {
    return (
      <div className="space-y-2 text-xs" role="alert">
        <p>Brokerage logo could not be loaded.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
      </div>
    );
  }

  if (!logo && !canManage) return null;

  if (variant === 'summary') {
    return (
      <div className={cn('mt-2 space-y-2', className)}>
        {logo && <img src={logo} alt={`${company || 'Brokerage'} logo`} className="h-16 w-full max-w-52 rounded-md border bg-white p-2 object-contain" />}
        {canManage && onEdit && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={onEdit}>
            <Upload aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{logo ? 'Change logo' : 'Add brokerage logo'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Brokerage logo" className={cn('w-full space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-left', className)}>
      <div>
        <h3 className="text-sm font-semibold">Brokerage logo</h3>
        <p className="mt-1 text-xs text-muted-foreground">Used on branded property tours and your portfolio.</p>
      </div>
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-dashed bg-white p-3">
        {logo ? (
          <img src={logo} alt={`${company || 'Brokerage'} logo`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-xs text-slate-500">
            <ImagePlus aria-hidden="true" className="h-6 w-6" /><span>No logo uploaded</span>
          </div>
        )}
      </div>
      {canManage && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Upload brokerage logo"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) save(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-9 flex-1 gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
              {mutation.isPending ? <InlineSpinner aria-hidden="true" className="h-4 w-4" /> : logo ? <RefreshCw aria-hidden="true" className="h-4 w-4" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
              {mutation.isPending ? 'Saving…' : logo ? 'Replace logo' : 'Upload logo'}
            </Button>
            {logo && <Button type="button" variant="ghost" size="sm" className="min-h-9 text-muted-foreground" disabled={busy} onClick={() => save(null)}>Remove</Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG or JPG · Up to 5 MB. Logo changes save automatically.</p>
        </>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
    </section>
  );
}
