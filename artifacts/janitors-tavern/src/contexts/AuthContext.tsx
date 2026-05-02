import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getStoredToken, getStoredUsername, storeAuth, clearStoredAuth } from '@/lib/auth';

const API_BASE = '/api';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  authConfigured: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/status`);
      const data = await res.json() as { isAuthenticated: boolean; username?: string };
      setAuthConfigured(data.isAuthenticated);

      if (!data.isAuthenticated) {
        setIsAuthenticated(true);
        setUsername('guest');
        return;
      }

      const token = getStoredToken();
      if (token) {
        const verifyRes = await fetch(`${API_BASE}/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (verifyRes.ok) {
          setIsAuthenticated(true);
          setUsername(getStoredUsername() || data.username || null);
        } else {
          clearStoredAuth();
          setIsAuthenticated(false);
          setUsername(null);
        }
      } else {
        setIsAuthenticated(false);
        setUsername(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUsername(null);
      setAuthConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (user: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password }),
      });
      const data = await res.json() as { success?: boolean; token?: string; username?: string; error?: string };
      if (res.ok && data.token) {
        storeAuth(data.token, data.username || user);
        setIsAuthenticated(true);
        setUsername(data.username || user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid username or password' };
    } catch (e) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, []);

  const register = useCallback(async (user: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password }),
      });
      const data = await res.json() as { success?: boolean; token?: string; error?: string };
      if (res.ok && data.token) {
        storeAuth(data.token, user);
        setIsAuthenticated(true);
        setAuthConfigured(true);
        setUsername(user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (e) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setIsAuthenticated(false);
    setUsername(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, authConfigured, username, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
