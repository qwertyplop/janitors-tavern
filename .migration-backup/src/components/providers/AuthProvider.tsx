'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSettings, verifyPassword, hashPassword, hasSessionCookie, clearSessionCookie } from '@/lib/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // First check if session cookie exists
      // If no session cookie, user is not authenticated
      if (!hasSessionCookie()) {
        setIsAuthenticated(false);
        setUsername(null);
        setLoading(false);
        return;
      }
      
      // Get auth settings directly from Firestore
      const authSettings = await getAuthSettings();
      
      if (authSettings.isAuthenticated && authSettings.username) {
        setIsAuthenticated(true);
        setUsername(authSettings.username);
      } else {
        setIsAuthenticated(false);
        setUsername(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Get auth settings to verify credentials
      const authSettings = await getAuthSettings();
      
      if (!authSettings.isAuthenticated || !authSettings.username || !authSettings.passwordHash) {
        return false;
      }

      // Verify the username matches
      if (username === authSettings.username) {
        // Verify the password against the stored hash
        const isPasswordValid = await verifyPassword(password, authSettings.passwordHash);
        
        if (isPasswordValid) {
          setIsAuthenticated(true);
          setUsername(username);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setUsername(null);
    
    // Clear session cookie
    clearSessionCookie();
    
    // Redirect to login page
    router.push('/login');
  };

  // Check if user should be redirected to login
  useEffect(() => {
    if (loading) {
      // Don't redirect while loading auth status
      return;
    }
    
    const currentPath = window.location.pathname;
    
    // Don't redirect if we're already on the login/register page or accessing public resources
    const isAuthPage = currentPath === '/login' || currentPath === '/register';
    const isPublicPath = currentPath.startsWith('/api/') || currentPath.startsWith('/_next/');
    
    if (!isAuthPage && !isPublicPath && !isAuthenticated) {
      // Preserve the current URL as callback URL
      const callbackUrl = encodeURIComponent(currentPath + window.location.search);
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [isAuthenticated, loading, router]);

  const value = {
    isAuthenticated,
    username,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}