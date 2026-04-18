const readStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token')
  );
};

export const getStoredAuthToken = () => readStoredToken();

export const getAuthToken = (sessionToken?: string | null) =>
  readStoredToken() || sessionToken || undefined;





