import React, { createContext, useState, useContext, useEffect } from 'react';
import type { UserData, UserRole, AuthSession } from '@/types/auth';
import { API_BASE_URL } from '@/config/env';
import { normalizeEmailHealth } from '@/utils/emailHealth';

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
  (typeof window !== 'undefined' &&
    (localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token'))) ||
  null;

const getSessionToken = (userId: string, role: Role) => getStoredToken() ?? generateMockJWT(userId, role);

const normalizeRole = (role?: string | null): Role => {
  if (!role) return 'admin';
  if (role === 'sales_rep' || role === 'salesrep' || role === 'sales-rep') return 'salesRep';
  return role as Role;
};

const normalizeApiUser = (apiUser: any, base?: UserData | null): UserData => {
  const role = normalizeRole(apiUser?.role ?? base?.role);
  return {
    ...(base ?? {}),
    ...(apiUser ?? {}),
    id: String(apiUser?.id ?? base?.id ?? ''),
    name: apiUser?.name ?? base?.name ?? '',
    email: apiUser?.email ?? base?.email ?? '',
    role,
    avatar: apiUser?.avatar ?? base?.avatar,
    phone: apiUser?.phone ?? apiUser?.phonenumber ?? apiUser?.phone_number ?? base?.phone,
    address: apiUser?.address ?? base?.address,
    city: apiUser?.city ?? base?.city,
    state: apiUser?.state ?? base?.state,
    zipcode: apiUser?.zipcode ?? apiUser?.zip ?? base?.zipcode,
    timezone: apiUser?.timezone ?? base?.timezone,
    company: apiUser?.company ?? apiUser?.company_name ?? base?.company,
    companyNotes: apiUser?.companyNotes ?? apiUser?.company_notes ?? base?.companyNotes,
    shootCcEmails: apiUser?.shootCcEmails ?? apiUser?.shoot_cc_emails ?? base?.shootCcEmails ?? base?.shoot_cc_emails ?? [],
    shoot_cc_emails: apiUser?.shoot_cc_emails ?? apiUser?.shootCcEmails ?? base?.shoot_cc_emails ?? base?.shootCcEmails ?? [],
    clientDiscountType: apiUser?.clientDiscountType ?? apiUser?.client_discount_type ?? base?.clientDiscountType ?? base?.client_discount_type ?? null,
    client_discount_type: apiUser?.client_discount_type ?? apiUser?.clientDiscountType ?? base?.client_discount_type ?? base?.clientDiscountType ?? null,
    clientDiscountValue: apiUser?.clientDiscountValue ?? apiUser?.client_discount_value ?? base?.clientDiscountValue ?? base?.client_discount_value ?? null,
    client_discount_value: apiUser?.client_discount_value ?? apiUser?.clientDiscountValue ?? base?.client_discount_value ?? base?.clientDiscountValue ?? null,
    bio: apiUser?.bio ?? base?.bio,
    about: apiUser?.about ?? base?.about,
    username: apiUser?.username ?? base?.username,
    facebookUrl: apiUser?.facebookUrl ?? apiUser?.facebook_url ?? base?.facebookUrl,
    twitterUrl: apiUser?.twitterUrl ?? apiUser?.twitter_url ?? base?.twitterUrl,
    linkedinUrl: apiUser?.linkedinUrl ?? apiUser?.linkedin_url ?? base?.linkedinUrl,
    pinterestUrl: apiUser?.pinterestUrl ?? apiUser?.pinterest_url ?? base?.pinterestUrl,
    createdAt: apiUser?.created_at ?? apiUser?.createdAt ?? base?.createdAt,
    isActive: apiUser?.account_status ? apiUser?.account_status === 'active' : base?.isActive,
    metadata: apiUser?.metadata ?? base?.metadata ?? {},
    email_health: normalizeEmailHealth(apiUser?.email_health ?? base?.email_health),
  };
};

const AUTH_SESSION_FINGERPRINT_KEY = 'auth_session_fingerprint';

const clearSessionScopedCaches = () => {
  if (typeof window === 'undefined') return;
  const keysToRemove = ['photographers_cache', 'photographers_cache_time'];

  keysToRemove.forEach((key) => sessionStorage.removeItem(key));

  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('photographers_cache:'))
    .forEach((key) => sessionStorage.removeItem(key));
};

const getOriginalUserIdFromStorage = () => {
  if (typeof window === 'undefined') return null;

  const storedOriginalUser = localStorage.getItem('originalUser');
  if (!storedOriginalUser) return null;

  try {
    const parsedOriginalUser = JSON.parse(storedOriginalUser);
    return parsedOriginalUser?.id ? String(parsedOriginalUser.id) : null;
  } catch {
    return null;
  }
};

const buildAuthFingerprint = ({
  user,
  role,
  isAuthenticated,
  token,
  originalUserId,
}: {
  user: UserData | null;
  role: Role;
  isAuthenticated: boolean;
  token: string | null;
  originalUserId?: string | null;
}) => {
  if (!user || !isAuthenticated || !token) {
    return 'guest';
  }

  return `${String(user.id)}:${role}:${originalUserId || 'none'}`;
};

const getPersistedAuthFingerprint = (): string => {
  if (typeof window === 'undefined') return 'guest';

  const storedToken = getStoredToken();
  const storedUser = localStorage.getItem('user');

  if (!storedToken || !storedUser) {
    return 'guest';
  }

  try {
    const parsedUser = normalizeApiUser(JSON.parse(storedUser));
    return buildAuthFingerprint({
      user: parsedUser,
      role: normalizeRole(parsedUser.role),
      isAuthenticated: true,
      token: storedToken,
      originalUserId: getOriginalUserIdFromStorage(),
    });
  } catch {
    return 'guest';
  }
};



export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<Role>('client');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [originalUser, setOriginalUser] = useState<UserData | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);

  // Monotonically increasing counter bumped every time impersonate() or
  // stopImpersonating() writes new user state.  Any async operation that
  // captured an earlier epoch must NOT write state — the impersonation
  // transition has already superseded whatever it was going to write.
  const impersonationEpochRef = React.useRef(0);

  // AbortController for the initial /api/user refresh — impersonate() cancels it
  // so a stale response can never overwrite the impersonated user.
  const refreshAbortRef = React.useRef<AbortController | null>(null);

  const clearStoredAuth = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser');
    sessionStorage.removeItem(AUTH_SESSION_FINGERPRINT_KEY);
    clearSessionScopedCaches();
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

    let initialUser: UserData | null = null;

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedUser = normalizeApiUser(parsedUser);
        const normalizedRole = normalizeRole(normalizedUser.role);
        initialUser = normalizedUser;
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

    const refreshUser = async () => {
      if (!storedToken) return;
      // Skip server refresh when impersonating — the stored token belongs to the
      // admin, so /api/user would return admin data and overwrite the impersonated
      // user.  We already loaded the impersonated user from localStorage above.
      const isCurrentlyImpersonating = !!localStorage.getItem('originalUser');
      if (isCurrentlyImpersonating) return;

      // Snapshot the epoch BEFORE the async work begins.
      const epochAtStart = impersonationEpochRef.current;

      // Create an AbortController so impersonate() can cancel this in-flight request.
      const controller = new AbortController();
      refreshAbortRef.current = controller;

      try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${storedToken}`,
          },
          signal: controller.signal,
        });

        // Re-check after the async gap — impersonation may have started while
        // the fetch was in flight.  If so, discard this (now stale) response.
        if (localStorage.getItem('originalUser')) return;
        if (impersonationEpochRef.current !== epochAtStart) return;

        if (response.status === 401 || response.status === 419) {
          clearStoredAuth();
          setUser(null);
          setIsAuthenticated(false);
          setRole('client');
          setSession(null);
          return;
        }

        if (!response.ok) {
          return;
        }

        const apiUser = await response.json();

        // Final guard before writing state — another async gap just passed.
        if (localStorage.getItem('originalUser')) return;
        if (impersonationEpochRef.current !== epochAtStart) return;

        const normalizedUser = normalizeApiUser(apiUser, initialUser);
        const normalizedRole = normalizeRole(normalizedUser.role);

        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
        setIsAuthenticated(true);
        setRole(normalizedRole);
        setSession(buildSession(storedToken, normalizedUser, normalizedRole));
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
        console.warn('Failed to refresh user data', error);
      } finally {
        if (refreshAbortRef.current === controller) {
          refreshAbortRef.current = null;
        }
      }
    };

    refreshUser();
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
    clearSessionScopedCaches();
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

    // Bump the epoch so any in-flight async work (refreshUser, fetches, etc.)
    // that captured an earlier epoch will silently discard its result.
    impersonationEpochRef.current += 1;

    // Cancel any in-flight /api/user refresh so its stale response can't
    // overwrite the impersonated user we're about to set.
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = null;

    // Store current (admin) user as original BEFORE anything else
    if (!isImpersonating) {
      const adminSnapshot = { ...user };
      localStorage.setItem('originalUser', JSON.stringify(adminSnapshot));
      setOriginalUser(adminSnapshot);
      setIsImpersonating(true);
    }

    // Normalize the target user data
    const roleToUse = normalizeRole(targetUser.role);
    const updatedUserData: UserData = {
      ...targetUser,
      id: String(targetUser.id),
      role: roleToUse,
      metadata: targetUser.metadata || {},
    };

    // Write to localStorage synchronously so that any subsequent API calls
    // (even from other modules reading localStorage directly) pick up the
    // impersonated user immediately.
    localStorage.setItem('user', JSON.stringify(updatedUserData));

    // Clear cached shoots so the new user context gets fresh data
    localStorage.removeItem('shoots');
    clearSessionScopedCaches();

    // Update React state
    setUser(updatedUserData);
    setRole(roleToUse);

    // Keep the real admin token — the backend middleware uses it to authenticate
    // the admin, then swaps to the impersonated user via the header.
    const sessionToken = getSessionToken(updatedUserData.id, roleToUse);
    setSession(buildSession(sessionToken, updatedUserData, roleToUse));
    
    console.log(`Impersonating user: ${targetUser.name} (${targetUser.email}), id=${updatedUserData.id}, epoch=${impersonationEpochRef.current}`);
  };

  const stopImpersonating = () => {
    if (!originalUser) return;

    // Bump the epoch so any in-flight async work from the impersonated
    // session silently discards its result.
    impersonationEpochRef.current += 1;

    // Write localStorage FIRST so any in-flight or subsequent API calls
    // immediately stop sending the impersonation header.
    localStorage.removeItem('originalUser');
    localStorage.setItem('user', JSON.stringify(originalUser));
    // Clear cached shoots so dashboard re-fetches for the admin context
    localStorage.removeItem('shoots');
    clearSessionScopedCaches();
    
    const restoredRole = normalizeRole(originalUser.role);
    setUser(originalUser);
    setRole(restoredRole);
    setIsImpersonating(false);
    setOriginalUser(null);

    // Restore session
    const sessionToken = getSessionToken(originalUser.id, restoredRole);
    setSession(buildSession(sessionToken, originalUser, restoredRole));
    
    console.log('Stopped impersonating, restored original user:', originalUser.name);
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
      const normalizedUser = normalizeApiUser(userData, user);
      // Keep the role if not provided in userData
      if (!userData.role) {
        normalizedUser.role = user.role;
      }
      
      // Store updated user data in localStorage
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      
      // Update role state if it changed
      if (userData.role && userData.role !== role) {
        setRole(userData.role as Role);
      }
      
      // Update session if it exists
      if (session) {
        const mockToken = generateMockJWT(normalizedUser.id, normalizedUser.role || role);
        
        setSession({
          ...session,
          accessToken: mockToken,
          user: {
            ...session.user,
            role: normalizedUser.role,
            metadata: {
              ...(session.user.metadata || {}),
              role: normalizedUser.role,
            },
          },
        });
      }
      
      console.log('User data updated');
    }
  };

  // Context value
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = getStoredToken();
    const fingerprint = buildAuthFingerprint({
      user,
      role,
      isAuthenticated,
      token,
      originalUserId: isImpersonating ? originalUser?.id ?? null : null,
    });

    sessionStorage.setItem(AUTH_SESSION_FINGERPRINT_KEY, fingerprint);
  }, [isAuthenticated, isImpersonating, originalUser?.id, role, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ensureFreshAuthState = () => {
      const inMemoryFingerprint = buildAuthFingerprint({
        user,
        role,
        isAuthenticated,
        token: getStoredToken(),
        originalUserId: isImpersonating ? originalUser?.id ?? null : null,
      });
      const persistedFingerprint = getPersistedAuthFingerprint();

      if (inMemoryFingerprint !== persistedFingerprint) {
        window.location.reload();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      ensureFreshAuthState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      ensureFreshAuthState();
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', ensureFreshAuthState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', ensureFreshAuthState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, isImpersonating, originalUser?.id, role, user]);

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
