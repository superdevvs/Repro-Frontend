
import { createContext, useContext } from 'react';
import { UserData } from '@/types/auth';
import { AuthSession } from '@/types/auth';

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string;
  session: AuthSession | null;
  login: (userData: UserData) => void;
  logout: () => void;
  setUserRole: (role: string) => void;
  setUser: (userData: UserData) => void; // Add setUser method
}

// Create context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: 'client',
  session: null,
  login: () => {},
  logout: () => {},
  setUserRole: () => {},
  setUser: () => {}, // Initialize with empty function
});

// Hook for using the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
