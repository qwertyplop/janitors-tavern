'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSettings } from '@/types';

// Define auth-related types

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

  const getAuthSettings = async (): Promise<AuthSettings> => {
    try {
      const response = await fetch('/api/settings/auth');
      if (!response.ok) {
        throw new Error('Failed to fetch auth settings');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching auth settings:', error);
      return { isAuthenticated: false };
    }
  };

  const checkAuthStatus = async () => {
    try {
      // Check if user is authenticated via localStorage
      const authed = localStorage.getItem('jt.authenticated') === 'true';
      const storedUsername = localStorage.getItem('jt.username');
      
      if (authed && storedUsername) {
        // Verify that auth is actually set up in the system
        const authSettings = await getAuthSettings();
        if (authSettings.isAuthenticated && authSettings.username === storedUsername) {
          setIsAuthenticated(true);
          setUsername(storedUsername);
        } else {
          // Auth state is invalid, clear it
          localStorage.removeItem('jt.authenticated');
          localStorage.removeItem('jt.username');
          setIsAuthenticated(false);
          setUsername(null);
        }
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
      
      if (!authSettings.isAuthenticated) {
        return false;
      }

      // Verify the username matches
      if (username === authSettings.username) {
        // In a real implementation, you would verify the password hash
        // For now, we'll just check if the username matches and auth is set up
        // Store authentication state
        localStorage.setItem('jt.authenticated', 'true');
        localStorage.setItem('jt.username', username);
        
        setIsAuthenticated(true);
        setUsername(username);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    // Clear authentication state
    localStorage.removeItem('jt.authenticated');
    localStorage.removeItem('jt.username');
    
    setIsAuthenticated(false);
    setUsername(null);
    
    // Redirect to login page
    router.push('/login');
  };

  // Check if user should be redirected to login
  useEffect(() => {
    const currentPath = window.location.pathname;
    
    // Don't redirect if we're already on the login page or accessing public resources
    const isLoginPage = currentPath === '/login';
    const isPublicPath = currentPath.startsWith('/api/') || currentPath.startsWith('/_next/');
    
    if (!isLoginPage && !isPublicPath && !loading && !isAuthenticated) {
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