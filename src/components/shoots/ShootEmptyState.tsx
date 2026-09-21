import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermission } from '@/hooks/usePermission';

interface ShootEmptyStateProps {
  title?: string;
  filtered?: boolean;
  onReset?: () => void;
  onViewRequested?: () => void;
  /** Only first-use upcoming/all-shoot views may offer booking. */
  allowBooking?: boolean;
  requested?: boolean;
  className?: string;
}

export function ShootEmptyState({ title = 'No upcoming shoots', filtered = false, onReset, onViewRequested, allowBooking = false, requested = false, className }: ShootEmptyStateProps) {
  const { can, isLoading } = usePermission();
  const canBook = allowBooking && !filtered && !isLoading && can('book-shoot', 'create');
  return <EmptyState
    icon={filtered ? 'search' : requested ? 'requests' : 'shoots'}
    title={filtered ? 'No shoots match these filters' : title}
    description={filtered ? 'Clear your filters to see more shoots.' : canBook ? 'Create your first shoot to get started.' : requested ? 'Shoots awaiting approval will appear here.' : 'Shoots will appear here when they are scheduled.'}
    className={className}
    action={filtered ? onReset && <Button variant="outline" onClick={onReset}>Clear Filters</Button> : (canBook || onViewRequested) && <>
      {canBook && <Button asChild><Link to="/book-shoot">Create New Shoot</Link></Button>}
      {onViewRequested && <Button variant="outline" onClick={onViewRequested}>View Requested</Button>}
    </>}
  />;
}
