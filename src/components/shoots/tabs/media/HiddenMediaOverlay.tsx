import { EyeOff } from 'lucide-react';

export function HiddenMediaOverlay() {
  return (
    <>
      <div className="absolute inset-0 bg-slate-950/10 z-[2] pointer-events-none" />
      <div className="absolute inset-x-3 bottom-3 z-[3] flex items-center justify-center pointer-events-none">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hidden</span>
        </div>
      </div>
    </>
  );
}
