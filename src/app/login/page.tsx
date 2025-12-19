'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthSettings } from '@/lib/auth';
import { useI18n } from '@/components/providers/I18nProvider';
import { useAuth } from '@/components/providers/AuthProvider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  
  const encodedCallbackUrl = searchParams.get('callbackUrl') || '/';
  const callbackUrl = decodeURIComponent(encodedCallbackUrl);

  // Check if already authenticated (only on initial load, not during login flow)
  useEffect(() => {
    // Only redirect if authentication was verified on initial load (not after login submission)
    if (!authLoading && isAuthenticated && !success) {
      router.push(callbackUrl);
    }
  }, [isAuthenticated, authLoading, callbackUrl, router, success]);
  
  // Check if auth is set up in Firestore, if not redirect to register
  useEffect(() => {
    const checkAuthSetup = async () => {
      if (authLoading) return; // Wait for auth loading to complete
      
      try {
        const authSettings = await getAuthSettings();
        if (!authSettings.isAuthenticated && !isAuthenticated) {
          // Auth is not set up in Firestore, redirect to register
          router.push('/register');
        }
      } catch (error) {
        console.error('Error checking auth setup:', error);
        setError(t.login.authError || 'Authentication error occurred');
      }
    };
    
    checkAuthSetup();
  }, [authLoading, isAuthenticated, router, t.login.authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Use the auth context to handle login
      // The login function in the context will verify credentials against Firestore
      const loginSuccess = await login(username, password);
      
      if (loginSuccess) {
        // Show success message and redirect immediately
        setSuccess('Login successful! Redirecting...');
        // Use setTimeout to ensure the success message is shown before redirect
        setTimeout(() => {
          const targetUrl = callbackUrl && callbackUrl !== '/login' ? callbackUrl : '/';
          // Use router.push for normal navigation
          router.push(targetUrl);
          // Set a fallback timeout in case router.push doesn't work
          setTimeout(() => {
            if (window.location.pathname === '/login') {
              window.location.href = targetUrl;
            }
          }, 1000); // Wait 1 second before fallback
        }, 500);
      } else {
        setError(t.login.invalidCredentials || 'Invalid username or password');
        setLoading(false);
      }
    } catch (err) {
      setError(t.login.authError || 'Authentication failed');
      console.error('Login error:', err);
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
            
            {success && (
              <div className="p-3 rounded-md bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-sm">
                {success}
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? t.login.loggingIn : t.login.signIn}
            </Button>
            
            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 mt-4">
              <a
                href="/register?force=true"
                className="text-blue-600 hover:underline"
              >
                {t.login.goToRegistration || 'Go to Registration'}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}