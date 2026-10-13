import { describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { canReorderMediaFile } from './mediaPresentationPermissions';
import { mergeMediaContextOrder } from './mediaContextOrder';

const file = (id: string, hidden = false): MediaFile => ({ id, filename: `${id}.jpg`, media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, is_hidden: hidden });
describe('restore-only rows do not corrupt photo reordering', () => {
  it.each(['client', 'salesRep'])('%s keeps hidden/shared rows displayed but excludes them from merged order and payload universe', role => {
    const displayed = [file('11'), file('12', true), file('13'), { ...file('14'), can_manage_visibility: false }];
    const sortable = displayed.filter(item => canReorderMediaFile(item, role));
    expect(sortable.map(item => item.id)).toEqual(['11', '13']);
    expect(mergeMediaContextOrder(['11', '13'], sortable, displayed, ['13', '12', '11', '14'])).toEqual(['13', '11']);
    expect(displayed).toHaveLength(4);
  });
  it('preserves another service pane, extras and the primary contractor hidden download scope', () => {
    const displayed = [file('11'), { ...file('12', true), can_download: true }, file('13'), { ...file('14'), isExtra: true }];
    const sortable = displayed.filter(item => canReorderMediaFile(item, 'photographer'));
    expect(sortable).toHaveLength(4);
    expect(mergeMediaContextOrder(['11', '12', '13', '14'], sortable, [displayed[0], displayed[2], displayed[3]], ['13', '11', '14'])).toEqual(['13', '12', '11', '14']);
  });
});
