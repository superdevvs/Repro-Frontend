import { ShootSettingsTab } from '@/components/dashboard/ShootSettingsTab';
import { ShootData } from '@/types/shoots';

interface ShootDetailsSettingsTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  onShootUpdate: () => void;
}

export function ShootDetailsSettingsTab(props: ShootDetailsSettingsTabProps) {
  return <ShootSettingsTab 
    shoot={props.shoot}
    isAdmin={props.isAdmin}
    isClient={false}
    onUpdate={(updated) => {
      props.onShootUpdate();
    }}
    onDelete={() => {}}
    onProcessPayment={() => {}}
    currentInvoice={null}
  />;
}



