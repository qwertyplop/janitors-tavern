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
        console.log('Auth settings from server:', authSettings);
        console.log('Stored username:', storedUsername);
        if (authSettings.isAuthenticated && authSettings.username === storedUsername) {
          setIsAuthenticated(true);
          setUsername(storedUsername);
          console.log('Auth status: authenticated');
        } else {
          // Auth state is invalid, clear it
          localStorage.removeItem('jt.authenticated');
          localStorage.removeItem('jt.username');
          setIsAuthenticated(false);
          setUsername(null);
          console.log('Auth status: cleared invalid auth state');
        }
      } else {
        // Check if auth is set up in the system but not in localStorage (edge case)
        const authSettings = await getAuthSettings();
        if (authSettings.isAuthenticated) {
          // Auth is set up in the system but not in localStorage, this is an inconsistent state
          // We should not set the user as authenticated without localStorage state
          setIsAuthenticated(false);
          setUsername(null);
          console.log('Auth status: auth set up in system but not in localStorage');
        } else {
          setIsAuthenticated(false);
          setUsername(null);
          console.log('Auth status: not authenticated');
        }
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
      console.log('Login - Auth settings retrieved:', authSettings);
      
      if (!authSettings.isAuthenticated) {
        console.log('Login failed - auth not set up');
        return false;
      }

      // Verify the username matches
      if (username === authSettings.username) {
        // Hash the provided password and compare with stored hash
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        console.log('Login - Comparing password hashes:', {
          inputHash: passwordHash,
          storedHash: authSettings.passwordHash,
          match: passwordHash === authSettings.passwordHash
        });
        
        // Compare the hashed password with the stored hash
        if (passwordHash === authSettings.passwordHash) {
          // Store authentication state
          localStorage.setItem('jt.authenticated', 'true');
          localStorage.setItem('jt.username', username);
          
          setIsAuthenticated(true);
          setUsername(username);
          console.log('Login successful - auth state stored in localStorage');
          
          // Refresh auth status to ensure consistency
          await checkAuthStatus();
          
          return true;
        } else {
          console.log('Login failed - password hash mismatch');
        }
      } else {
        console.log('Login failed - username mismatch');
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    // Clear authentication state
    localStorage.removeItem('jt.authenticated');
    localStorage.removeItem('jt.username');
    
    setIsAuthenticated(false);
    setUsername(null);
    
    // Refresh auth status to ensure consistency
    await checkAuthStatus();
    
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
    
    // Don't redirect if we're already on the login page or accessing public resources
    const isLoginPage = currentPath === '/login';
    const isPublicPath = currentPath.startsWith('/api/') || currentPath.startsWith('/_next/');
    
    if (!isLoginPage && !isPublicPath && !isAuthenticated) {
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