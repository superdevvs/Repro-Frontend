import { Eye, EyeOff } from 'lucide-react';

export type ClientVisibility = 'visible' | 'hidden';

const options: Array<{ value: ClientVisibility; label: string; description: string; icon: typeof Eye }> = [
  { value: 'visible', label: 'Visible to client', description: 'Shown in the client gallery, downloads and share links', icon: Eye },
  { value: 'hidden', label: 'Hidden', description: 'Kept from the client gallery, downloads, ZIPs and share links', icon: EyeOff },
];

/** Staff-only client visibility. Hidden media stays visible to admins and editing managers. */
export function MediaMarkVisibilityPanel({ value, onChange, hiddenCount, total }: {
  value: ClientVisibility | ''; onChange: (value: ClientVisibility) => void; hiddenCount: number; total: number;
}) {
  const current = hiddenCount === 0 ? 'All selected media is visible to the client.'
    : hiddenCount === total ? 'All selected media is hidden from the client.'
      : `${hiddenCount} of ${total} selected files are hidden from the client.`;
  return <div className="space-y-4">
    <div className="mark-panel-heading"><span className="mark-eyebrow">Client visibility</span><h3>Should the client see this media?</h3><p>{current} Admins and editing managers always see hidden media.</p></div>
    <div className="mark-type-grid" role="radiogroup" aria-label="Client visibility">
      {options.map(option => <button key={option.value} type="button" role="radio" aria-label={option.label} aria-checked={value === option.value} className={`mark-option ${value === option.value ? 'is-selected' : ''}`} onClick={() => onChange(option.value)}>
        <span className="mark-option-icon"><option.icon aria-hidden="true" /></span><span><strong>{option.label}</strong><small>{option.description}</small></span><span className="mark-radio" />
      </button>)}
    </div>
  </div>;
}
