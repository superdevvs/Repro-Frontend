import type { CSSProperties } from 'react';
import camera from '@/assets/service-picker/camera.svg';
import cameraSmall from '@/assets/service-picker/camera-small.svg';
import video from '@/assets/service-picker/video.svg';
import drone from '@/assets/service-picker/drone.svg';
import droneSmall from '@/assets/service-picker/drone-small.svg';
import floor from '@/assets/service-picker/floor.svg';
import floorSmall from '@/assets/service-picker/floor-small.svg';
import spark from '@/assets/service-picker/spark.svg';
import sparkSmall from '@/assets/service-picker/spark-small.svg';
import grid from '@/assets/service-picker/grid.svg';
import search from '@/assets/service-picker/search.svg';
import close from '@/assets/service-picker/close.svg';
import check from '@/assets/service-picker/check.svg';

const assets = { camera, video, drone, floor, spark, grid, search, close, check };
const smallAssets = { camera: cameraSmall, drone: droneSmall, floor: floorSmall, spark: sparkSmall };
export type ServicePickerIconName = keyof typeof assets;

/** Original Figma vectors, painted through a mask so both themes share geometry. */
export function ServicePickerIcon({ name, small = false }: { name: ServicePickerIconName; small?: boolean }) {
  const asset = small && name in smallAssets ? smallAssets[name as keyof typeof smallAssets] : assets[name];
  return <span aria-hidden="true" className={small ? 'service-picker-icon service-picker-icon-small' : 'service-picker-icon'}
    style={{ '--picker-icon': `url("${asset}")` } as CSSProperties} />;
}
