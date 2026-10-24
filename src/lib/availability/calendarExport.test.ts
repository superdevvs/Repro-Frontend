import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { buildAvailabilityExportEvents } from './calendarExport';
import type { BackendSlot } from '@/types/availability';

describe('availability calendar export', () => {
  const base: BackendSlot = {id:1,photographer_id:42,day_of_week:'monday',start_time:'09:00',end_time:'17:00',status:'available'};
  it('expands every matching weekday instead of repeating the range start', () => {
    const events=buildAvailabilityExportEvents([base],new Date(2026,9,24),new Date(2026,10,3),'Mia');
    expect(events.map(event=>format(event.start,'yyyy-MM-dd HH:mm'))).toEqual(['2026-10-26 09:00','2026-11-02 09:00']);
  });
  it('honors dated overrides and subtracts booked and blocked windows', () => {
    const rows=[base,{...base,id:2,date:'2026-10-26',end_time:'15:00'},{...base,id:3,date:'2026-10-26',status:'booked',start_time:'10:00',end_time:'11:00'}, {...base,id:4,date:'2026-10-26',status:'unavailable',start_time:'14:00',end_time:'15:00'}];
    const events=buildAvailabilityExportEvents(rows,new Date(2026,9,26),new Date(2026,9,26),'Mia');
    expect(events.map(event=>[format(event.start,'HH:mm'),format(event.end,'HH:mm')])).toEqual([['09:00','10:00'],['11:00','14:00']]);
  });
  it('exports no windows for invalid ranges or fully blocked dates', () => {
    expect(buildAvailabilityExportEvents([base],new Date(2026,10,3),new Date(2026,9,24),'Mia')).toEqual([]);
    expect(buildAvailabilityExportEvents([base,{...base,id:2,date:'2026-10-26',status:'unavailable'}],new Date(2026,9,26),new Date(2026,9,26),'Mia')).toEqual([]);
  });
  it('uses the photographer timezone across daylight saving, independently of the browser', () => {
    const events=buildAvailabilityExportEvents([base],new Date(2026,9,24),new Date(2026,10,3),'Mia','America/New_York');
    expect(events.map(event=>event.start.toISOString())).toEqual(['2026-10-26T13:00:00.000Z','2026-11-02T14:00:00.000Z']);
  });
});
