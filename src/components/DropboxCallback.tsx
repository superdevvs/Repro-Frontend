import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

// Legacy browser token exchange is retired. Studio OAuth returns via the server.
export default function DropboxCallback() {
  useEffect(() => {
    localStorage.removeItem('dropbox_access_token');
  }, []);

  return <Navigate to="/integrations?dropbox=error" replace />;
}