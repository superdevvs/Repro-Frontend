import { Navigate, useLocation } from 'react-router-dom';
import { integrationsReturnPath } from '@/services/studioDropbox';

const Integrations = () => {
  const { search } = useLocation();
  // Redirect to Settings page with integrations tab
  return <Navigate to={integrationsReturnPath(search)} replace />;
};

export default Integrations;
