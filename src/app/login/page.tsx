'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthSettings } from '@/types';
import { useI18n } from '@/components/providers/I18nProvider';
import { useAuth } from '@/components/providers/AuthProvider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { login } = useAuth();
  
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const { isAuthenticated } = useAuth();
  
  // Check if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(callbackUrl);
    }
  }, [isAuthenticated, callbackUrl, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get stored auth settings to check if auth is set up
      const authSettings = await getAuthSettings();
      
      if (!authSettings.isAuthenticated) {
        setError(t.login.noAuthSetup);
        setLoading(false);
        return;
      }

      // Use the auth context to handle login
      // The login function in the context will verify credentials against stored auth settings
      const loginSuccess = await login(username, password);
      
      if (loginSuccess) {
        // Show success message and redirect to dashboard after a brief delay
        setError(''); // Clear any previous error
        // Redirect to dashboard (or original callback URL if it's not the login page)
        const targetUrl = callbackUrl && callbackUrl !== '/login' ? callbackUrl : '/';
        router.push(targetUrl);
      } else {
        setError(t.login.invalidCredentials);
      }
    } catch (err) {
      setError(t.login.authError);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t.login.title}
          </CardTitle>
          <CardDescription>
            {t.login.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.login.username}</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.login.usernamePlaceholder}
                required
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t.login.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.login.passwordPlaceholder}
                required
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? t.login.loggingIn : t.login.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}