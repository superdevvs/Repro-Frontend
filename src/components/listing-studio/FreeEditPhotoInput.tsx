import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { FreeEditsEligibility, PhotoEditType } from '@/services/listingStudioFreeEdits';

export interface FreeEditPhoto {
  file: File | null;
  editType: PhotoEditType | '';
}

export function FreeEditPhotoInput({ index, value, offer, disabled, onChange }: {
  index: number;
  value: FreeEditPhoto;
  offer: FreeEditsEligibility['offer'];
  disabled: boolean;
  onChange: (value: FreeEditPhoto) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!value.file) { setPreview(''); return; }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);
  const number = index + 1;
  return <fieldset className="min-w-0 rounded-xl border bg-card p-4" disabled={disabled}>
    <legend className="px-1 text-sm font-semibold">Photo {number}</legend>
    {preview ? <div className="relative mb-3">
      <img src={preview} alt={`Selected photo ${number}`} className="h-32 w-full rounded-lg object-contain bg-muted" />
      <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-8 w-8" aria-label={`Remove photo ${number}`} disabled={disabled} onClick={() => onChange({ ...value, file: null })}><X className="h-4 w-4" /></Button>
    </div> : <div className="mb-3 flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30"><ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden="true" /></div>}
    <input ref={input} type="file" accept={offer.allowed_mime_types.join(',')} className="sr-only" aria-label={`Upload photo ${number}`} disabled={disabled} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) onChange({ ...value, file });
    }} />
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => input.current?.click()}>{value.file ? 'Replace photo' : 'Choose photo'} {number}</Button>
    {value.file && <p className="mt-2 break-all text-xs text-muted-foreground">{value.file.name}</p>}
    <div className="mt-4 space-y-1.5">
      <Label htmlFor={`free-edit-type-${number}`}>Edit for photo {number}</Label>
      <select id={`free-edit-type-${number}`} value={value.editType} disabled={disabled} required className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={event => onChange({ ...value, editType: event.target.value as PhotoEditType })}>
        <option value="">Choose an edit</option>
        {offer.edit_types.map(type => <option key={type.code} value={type.code}>{type.label}</option>)}
      </select>
    </div>
  </fieldset>;
}
