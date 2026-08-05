import type React from 'react';
import type { ShootsTabsCardProps } from './shootsTabsCardUtils';
import { useShootsTabsCardController } from './useShootsTabsCardController';
import { EditingManagerShootsTabsView } from './EditingManagerShootsTabsView';
import { DefaultShootsTabsView } from './DefaultShootsTabsView';

export const ShootsTabsCard: React.FC<ShootsTabsCardProps> = (props) => {
  const model = useShootsTabsCardController(props);
  return model.isEditingManagerMode
    ? <EditingManagerShootsTabsView model={model} />
    : <DefaultShootsTabsView model={model} />;
};
