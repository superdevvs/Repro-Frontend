import { useShootEditModalController } from './useShootEditModalController';
import { ShootEditModalView } from './ShootEditModalView';
import type { ShootEditModalProps } from './shootEditModalTypes';

export function ShootEditModal(props: ShootEditModalProps) {
  const model = useShootEditModalController(props);
  return <ShootEditModalView model={model} />;
}
