import { Camera, Columns3, ImagePlus, Layers3, Moon, Mountain, Plane, Sun, Tag } from 'lucide-react';
import { markMenuOptions, type ReclassifyMediaType } from '../shootMediaActionTypes';

const icons = [Camera, Columns3, ImagePlus, Layers3, Mountain, Moon, Plane];
const descriptions = ['Primary property photography', 'Plans, layouts and diagrams', 'Supporting and reference media', 'Digitally furnished spaces', 'Lawn and landscape treatment', 'Evening and twilight images', 'Aerial property coverage'];
export function MediaMarkTypePanel({ value, onChange, allowed }: { value: ReclassifyMediaType | ''; onChange: (value: ReclassifyMediaType) => void; allowed: boolean }) {
  if (!allowed) return <div className="mark-empty"><Tag /><h3>Select media to mark</h3><p>Choose files in the media library to change their category.</p></div>;
  return <div className="space-y-4">
    <div className="mark-panel-heading"><span className="mark-eyebrow">Organize the library</span><h3>What kind of media is this?</h3><p>Change the category. The booked service and delivery stay the same.</p></div>
    <div className="mark-type-grid" role="radiogroup" aria-label="Media type">
      {markMenuOptions.map((option, index) => { const Icon = icons[index] ?? Sun; return <button key={option.value} type="button" role="radio" aria-label={option.label} aria-checked={value === option.value} className={`mark-option ${value === option.value ? 'is-selected' : ''}`} onClick={() => onChange(option.value)}>
        <span className="mark-option-icon"><Icon aria-hidden="true" /></span><span><strong>{option.label}</strong><small>{descriptions[index]}</small></span><span className="mark-radio" />
      </button>; })}
    </div>
  </div>;
}
