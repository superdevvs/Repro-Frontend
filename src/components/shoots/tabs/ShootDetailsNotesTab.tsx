import { ShootNotesTab } from '@/components/dashboard/ShootNotesTab';
import { ShootData } from '@/types/shoots';

interface ShootDetailsNotesTabProps {
  contextualSearch?: boolean;
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  role: string;
  onShootUpdate: () => void;
}

export function ShootDetailsNotesTab(props: ShootDetailsNotesTabProps) {
  return <ShootNotesTab 
    contextualSearch={props.contextualSearch}
    shoot={props.shoot}
    isAdmin={props.isAdmin}
    isPhotographer={props.isPhotographer}
    role={props.role}
  />;
}



