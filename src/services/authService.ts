
import { UserData, AuthSession } from '@/types/auth';

// Helper function to convert string to base64url format (JWT compatible)
const toBase64Url = (str: string): string => {
  // First encode to base64
  const base64 = btoa(str)
    // Then convert to base64url by replacing characters
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
};

// Generate a properly formatted mock JWT token that will pass validation
const generateMockJWT = (userId: string, role: string): string => {
  // Create a base64url encoded header
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  
  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000);
  
  // Create a base64url encoded payload with standard JWT claims
  const payload = toBase64Url(JSON.stringify({
    sub: userId,
    role: role,
    iat: now,
    exp: now + 3600,
    iss: 'necyyfxufhmacccbhkdm',
    aud: 'authenticated'
  }));
  
  // Create a valid signature format
  // In a real JWT, this would be cryptographically signed
  // For our mock JWT, we'll create something that looks valid to parsers
  const mockSecret = 'development-mock-secret-key-for-testing-only';
  const mockSignatureData = `${header}.${payload}.${mockSecret}`;
  const signature = toBase64Url(mockSignatureData);
  
  // Combine all parts with dots to form a valid JWT structure
  return `${header}.${payload}.${signature}`;
};

const normalizeRole = (role?: string | null) => {
  if (!role) return 'client';
  if (role === 'sales_rep' || role === 'salesrep' || role === 'sales-rep') return 'salesRep';
  return role as UserData['role'];
};

// Login function that stores user data in localStorage
export const loginUser = (
  userData: UserData, 
  setUser: (user: UserData) => void,
  setIsAuthenticated: (value: boolean) => void,
  setRole: (role: string) => void,
  setSession: (session: AuthSession | null) => void
) => {
  // Store user data in localStorage
  const normalizedUser = { ...userData, role: normalizeRole(userData.role), metadata: userData.metadata || {} };
  localStorage.setItem('user', JSON.stringify(normalizedUser));
  // Update state
  setUser(normalizedUser);
  setIsAuthenticated(true);
  setRole(normalizedUser.role || 'client');
  
  // Create a proper JWT token structure
  const mockToken = generateMockJWT(normalizedUser.id, normalizedUser.role || 'client');
  
  // Set a mock session for development purposes
  const mockSession: AuthSession = {
    accessToken: mockToken,
    refreshToken: 'mock-refresh-token',
    tokenType: 'bearer',
    expiresIn: 3600,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    issuedAt: Math.floor(Date.now() / 1000),
    user: {
      id: normalizedUser.id,
      email: normalizedUser.email,
      role: normalizedUser.role,
      metadata: normalizedUser.metadata || {},
      createdAt: normalizedUser.createdAt || new Date().toISOString(),
    },
  };
  
  setSession(mockSession);
  console.log('Login successful via authService');
};

// Logout function that removes user data from localStorage
export const logoutUser = (
  setUser: (user: null) => void,
  setIsAuthenticated: (value: boolean) => void,
  setRole: (role: string) => void,
  setSession: (session: null) => void
) => {
  // Remove user data from localStorage
  localStorage.removeItem('user');
  // Update state
  setUser(null);
  setIsAuthenticated(false);
  setRole('client');
  setSession(null);
  console.log('Logout successful via authService');
};

// Function to update user role
export const updateUserRole = (
  role: string,
  setRole: (role: string) => void,
  user: UserData | null,
  setUser: (user: UserData | null) => void,
  session: AuthSession | null,
  setSession: (session: AuthSession | null) => void
) => {
  // Make sure we're using a valid Role type by casting it
  const typedRole = normalizeRole(role);
  
  if (user) {
    const updatedUser = { ...user, role: typedRole };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    // Update session if it exists
    if (session) {
      // Generate a new JWT with the updated role
      const mockToken = generateMockJWT(user.id, typedRole);
      
      setSession({
        ...session,
        accessToken: mockToken,
        user: {
          ...session.user,
          role: typedRole,
          metadata: {
            ...(session.user.metadata || {}),
            role: typedRole,
          },
        },
      });
    }
    
    console.log('User role updated via authService to:', role);
  }
  setRole(typedRole);
};
