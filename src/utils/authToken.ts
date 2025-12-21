export const getAuthToken = (sessionToken?: string | null) =>
  sessionToken ||
  localStorage.getItem('authToken') ||
  localStorage.getItem('token') ||
  undefined;





