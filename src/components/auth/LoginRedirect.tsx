import { Navigate, useLocation } from 'react-router-dom';
import { getLoginPath } from './loginReturn';

export function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={getLoginPath(location)} replace />;
}
