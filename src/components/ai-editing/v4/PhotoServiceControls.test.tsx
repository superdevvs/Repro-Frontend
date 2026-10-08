import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoServiceControls } from './PhotoServiceControls';
import { initialConfig, findPreset } from '@/components/studio/v4/presets';

afterEach(cleanup);
describe('provider-specific photo recipes', () => {
  it.each(['upscale', 'green-grass', 'twilight'])('%s omits staging, sky, and style selectors', presetId => {
    render(<PhotoServiceControls presetId={presetId} config={initialConfig(findPreset(presetId), [])} adjust={vi.fn()} disabled={false} />);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    expect(initialConfig(findPreset(presetId), []).adjustments).toEqual({});
  });
  it('uses only published cloud values for sky replacement', () => {
    const adjust = vi.fn();
    render(<PhotoServiceControls presetId="sky-replacement" config={initialConfig(findPreset('sky-replacement'), [])} adjust={adjust} disabled={false} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Sky style'), { target: { value: 'HIGH_CLOUD' } });
    expect(adjust).toHaveBeenCalledWith('cloudType', 'HIGH_CLOUD');
  });
  it('full shoot has documented cloud preferences and no invented numeric provider settings', () => {
    const adjust = vi.fn();
    render(<PhotoServiceControls presetId="full-shoot" config={initialConfig(findPreset('full-shoot'), [])} adjust={adjust} disabled={false} />);
    fireEvent.change(screen.getByLabelText('Exterior cloud style'), { target: { value: 'clear_fade' } });
    expect(adjust).toHaveBeenCalledWith('cloud_style', 'clear_fade');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Furniture style')).not.toBeInTheDocument();
  });
});
