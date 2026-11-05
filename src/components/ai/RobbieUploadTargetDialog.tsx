import { useState } from 'react';
import { Camera, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { UploadServiceTarget } from '@/components/shoots/tabs/media/mediaUploadUtils';
import type { AiActionPayload } from '@/types/ai';

export interface RobbieUploadChoice { action: AiActionPayload; targets: UploadServiceTarget[] }
export function RobbieUploadTargetDialog({ choice, onChoose, onClose }: { choice: RobbieUploadChoice | null; onChoose: (id: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState('');
  if (!choice) return null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-lg rounded-2xl"><DialogHeader><DialogTitle>Choose the booked service</DialogTitle><DialogDescription>Your files are staged. Choose where they belong before Robbie uploads them.</DialogDescription></DialogHeader><div className="max-h-[50dvh] space-y-2 overflow-y-auto" role="radiogroup" aria-label="Upload service">{choice.targets.map(target => <button key={target.id} type="button" role="radio" aria-checked={selected === target.id} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === target.id ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setSelected(target.id)}><Camera className="h-5 w-5 text-primary" /><span><strong className="block text-sm">{target.label}</strong><span className="text-[11px] text-muted-foreground">Service #{target.id}{target.scheduledAt ? ` · ${new Date(target.scheduledAt).toLocaleDateString()}` : ''}</span></span><Layers3 className="ml-auto h-4 w-4 text-muted-foreground" /></button>)}</div><DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!selected} onClick={() => onChoose(selected)}>Upload to service</Button></DialogFooter></DialogContent></Dialog>;
}
