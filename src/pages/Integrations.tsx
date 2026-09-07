import { Navigate } from 'react-router-dom';

const Integrations = () => {
  // Redirect to Settings page with integrations tab
  return <Navigate to="/settings?tab=integrations" replace />;
};

export default Integrations;
