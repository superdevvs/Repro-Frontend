import { motion } from 'framer-motion';
import { LayoutGrid, Image as ImageIcon, Video } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StudioSubtab } from './types';

/**
 * StudioSubtabNav renders the `[ Studio | Photo | Video ]` selector for the
 * Studio shell and highlights the active Subtab (Req 1.5, 2.1, 2.5).
 *
 * It is a controlled component: the parent owns `activeSubtab` and reacts to
 * `onSelect`. It performs no navigation itself, so switching never takes the
 * Client away from the page.
 */
export interface StudioSubtabNavProps {
  activeSubtab: StudioSubtab;
  onSelect: (subtab: StudioSubtab) => void;
  className?: string;
}

const SUBTABS: { id: StudioSubtab; label: string; Icon: React.ElementType }[] = [
  { id: 'studio', label: 'Studio', Icon: LayoutGrid },
  { id: 'photo', label: 'Photo', Icon: ImageIcon },
  { id: 'video', label: 'Video', Icon: Video },
];

export function StudioSubtabNav({ activeSubtab, onSelect, className }: StudioSubtabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Studio sections"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-muted/40 p-1',
        className,
      )}
    >
      {SUBTABS.map(({ id, label, Icon }) => {
        const isActive = activeSubtab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            className={cn(
              'relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="studio-subtab-active"
                className="absolute inset-0 rounded-full bg-background shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default StudioSubtabNav;
