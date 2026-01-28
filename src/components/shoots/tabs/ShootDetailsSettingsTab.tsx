import { ShootSettingsTab } from '@/components/dashboard/ShootSettingsTab';
import { ShootData } from '@/types/shoots';
import { useAuth } from '@/components/auth';

interface ShootDetailsSettingsTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  onShootUpdate: () => void;
}

export function ShootDetailsSettingsTab(props: ShootDetailsSettingsTabProps) {
  const { user } = useAuth();
  const role = user?.role || 'client';
  const isClient = role === 'client';
  return <ShootSettingsTab 
    shoot={props.shoot}
    isAdmin={props.isAdmin}
    isClient={isClient}
    onUpdate={(updated) => {
      props.onShootUpdate();
    }}
    onDelete={() => {}}
    onProcessPayment={() => {}}
    currentInvoice={null}
  />;
}



