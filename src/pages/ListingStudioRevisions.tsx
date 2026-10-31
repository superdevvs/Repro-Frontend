import { Navigate, useLocation } from 'react-router-dom';
import { studioRevisionsDashboardHref } from '@/utils/studioRevisionNavigation';

// Preserve existing bookmarks and task links in the dashboard request manager.
export default function ListingStudioRevisions() {
  const location = useLocation();
  return <Navigate replace to={studioRevisionsDashboardHref(location.search)} />;
}
