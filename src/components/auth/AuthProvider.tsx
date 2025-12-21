import React, { createContext, useState, useContext, useEffect } from 'react';
import type { UserData, UserRole, AuthSession } from '@/types/auth';

// Define the Role type via shared types
export type Role = UserRole;

// Align local User shape with global UserData definition
export type User = UserData;

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: Role;
  session: AuthSession | null;
  login: (userData: UserData, token?: string) => void;
  logout: () => void;
  setUserRole: (role: Role) => void;
  setUser: (userData: UserData) => void;
  impersonate: (user: UserData) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
  originalUser: UserData | null;
}

// Create a context object
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: 'client',
  session: null,
  login: () => {},
  logout: () => {},
  setUserRole: () => {},
  setUser: () => {},
  impersonate: () => {},
  stopImpersonating: () => {},
  isImpersonating: false,
  originalUser: null,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

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

const buildSession = (token: string, user: UserData, role: Role): AuthSession => ({
  accessToken: token,
  refreshToken: null,
  tokenType: 'bearer',
  expiresIn: 3600,
  issuedAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: user.id,
    email: user.email,
    role,
    metadata: user.metadata || {},
    createdAt: user.createdAt || new Date().toISOString(),
  },
});

// Generate a properly formatted mock JWT token that will pass validation
const generateMockJWT = (userId: string, role: string): string => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(JSON.stringify({
    sub: userId,
    role: role,
    iat: now,
    exp: now + 3600,
    iss: 'necyyfxufhmacccbhkdm',
    aud: 'authenticated'
  }));
  const mockSecret = 'development-mock-secret-key-for-testing-only';
  const mockSignatureData = `${header}.${payload}.${mockSecret}`;
  const signature = toBase64Url(mockSignatureData);
  return `${header}.${payload}.${signature}`;
};

const getStoredToken = () =>
  (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem('token'))) || null;

const normalizeRole = (role?: string | null): Role => {
  if (!role) return 'admin';
  if (role === 'sales_rep' || role === 'salesrep' || role === 'sales-rep') return 'salesRep';
  return role as Role;
};



export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<Role>('client');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [originalUser, setOriginalUser] = useState<UserData | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);

  const clearStoredAuth = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser');
  };

  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    const storedOriginalUser = localStorage.getItem('originalUser');
    if (storedOriginalUser) {
      try {
        setOriginalUser(JSON.parse(storedOriginalUser));
        setIsImpersonating(true);
      } catch (e) {
        localStorage.removeItem('originalUser');
      }
    }

    const storedUser = localStorage.getItem('user');
    const storedToken = getStoredToken();

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedRole = normalizeRole(parsedUser.role);
        const normalizedUser = {
          ...parsedUser,
          role: normalizedRole,
          metadata: parsedUser.metadata || {},
        };
        setUser(normalizedUser);
        setIsAuthenticated(true);
        setRole(normalizedRole);
        setSession(buildSession(storedToken, normalizedUser, normalizedRole));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        clearStoredAuth();
        setUser(null);
        setIsAuthenticated(false);
        setRole('client');
        setSession(null);
      }
    } else {
      clearStoredAuth();
      setUser(null);
      setIsAuthenticated(false);
      setRole('client');
      setSession(null);
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = (userData: UserData, authToken?: string) => {
    // Normalize role across API variations
    const roleToUse = normalizeRole(userData.role);
    const tokenToUse = authToken || getStoredToken();

    if (authToken) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('token', authToken);
      }
    }

    // Update userData with the role
    const updatedUserData = {
      ...userData,
      role: roleToUse,
      metadata: userData.metadata || {},
    };
    // Store the user data in localStorage
    localStorage.setItem('user', JSON.stringify(updatedUserData));
    setUser(updatedUserData);
    setIsAuthenticated(true);
    setRole(roleToUse);

    if (tokenToUse) {
      setSession(buildSession(tokenToUse, updatedUserData, roleToUse));
    } else {
      setSession(null);
    }

    console.log('Login successful, user role:', roleToUse);
  };

  // Logout function
  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setOriginalUser(null);
    setIsImpersonating(false);
    setIsAuthenticated(false);
    setRole('client');
    setSession(null);
    console.log('User logged out');
  };

  const impersonate = (targetUser: UserData) => {
    if (!user) return;

    // Store current user as original if not already impersonating
    if (!isImpersonating) {
      setOriginalUser(user);
      localStorage.setItem('originalUser', JSON.stringify(user));
      setIsImpersonating(true);
    }

    // Switch to target user
    const roleToUse = normalizeRole(targetUser.role);
    const updatedUserData = {
      ...targetUser,
      role: roleToUse,
      metadata: targetUser.metadata || {},
    };

    localStorage.setItem('user', JSON.stringify(updatedUserData));
    setUser(updatedUserData);
    setRole(roleToUse);

    // Create a mock session for the impersonated user
    const mockToken = generateMockJWT(updatedUserData.id, roleToUse);
    setSession(buildSession(mockToken, updatedUserData, roleToUse));
    
    console.log(`Impersonating user: ${targetUser.email}`);
  };

  const stopImpersonating = () => {
    if (!originalUser) return;

    // Restore original user
    localStorage.setItem('user', JSON.stringify(originalUser));
    localStorage.removeItem('originalUser');
    
    setUser(originalUser);
    setRole(originalUser.role || 'client');
    setIsImpersonating(false);
    setOriginalUser(null);

    // Restore session
    const mockToken = generateMockJWT(originalUser.id, originalUser.role || 'client');
    setSession(buildSession(mockToken, originalUser, originalUser.role || 'client'));
    
    console.log('Stopped impersonating, restored original user');
  };

  const setUserRole = (newRole: Role) => {
    setRole(newRole);
    
    // Update user object with new role
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('User role updated to:', newRole);
      
      // Update session if it exists
      if (session) {
        const mockToken = generateMockJWT(user.id, newRole);
        
        setSession({
          ...session,
          accessToken: mockToken,
          user: {
            ...session.user,
            role: newRole,
            metadata: {
              ...(session.user.metadata || {}),
              role: newRole,
            },
          },
        });
      }
    }
  };

  // Update user data function
  const updateUser = (userData: UserData) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      // Keep the role if not provided in userData
      if (!userData.role) {
        updatedUser.role = user.role;
      }
      
      // Store updated user data in localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      // Update role state if it changed
      if (userData.role && userData.role !== role) {
        setRole(userData.role as Role);
      }
      
      // Update session if it exists
      if (session) {
        const mockToken = generateMockJWT(updatedUser.id, updatedUser.role || role);
        
        setSession({
          ...session,
          accessToken: mockToken,
          user: {
            ...session.user,
            role: updatedUser.role,
            metadata: {
              ...(session.user.metadata || {}),
              role: updatedUser.role,
            },
          },
        });
      }
      
      console.log('User data updated');
    }
  };

  // Context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    role,
    session,
    login,
    logout,
    setUserRole,
    setUser: updateUser,
    impersonate,
    stopImpersonating,
    isImpersonating,
    originalUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};