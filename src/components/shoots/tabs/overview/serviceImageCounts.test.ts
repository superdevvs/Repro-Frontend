import { describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { countServicePhotos } from './serviceImageCounts';

describe('booked photo counts', () => {
  it('does not let floorplans, extras, video or another service inflate a photo target', () => {
    const files = [
      { id: '1', shoot_service_id: '11', filename: 'front.jpg', fileType: 'image/jpeg', media_type: 'edited' },
      { id: '2', shoot_service_id: '11', filename: 'plan.jpg', fileType: 'image/jpeg', media_type: 'floorplan' },
      { id: '3', shoot_service_id: '11', filename: 'extra.jpg', fileType: 'image/jpeg', isExtra: true },
      { id: '4', shoot_service_id: '11', filename: 'video.mp4', fileType: 'video/mp4', media_type: 'video' },
      { id: '5', shoot_service_id: '12', filename: 'other.jpg', fileType: 'image/jpeg' },
    ] as MediaFile[];
    expect(countServicePhotos(files, '11')).toBe(1);
  });
});
