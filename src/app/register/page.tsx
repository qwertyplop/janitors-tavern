'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/components/providers/I18nProvider';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  // Check if auth is already set up
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const forceRegister = urlParams.get('force');
        
        // If force parameter is present, skip auth check
        if (forceRegister === 'true') {
          return;
        }
        
        const response = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-auth-status' }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated) {
            // If auth is already set up, redirect to login
            router.push('/login');
          }
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };

    checkAuthStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Basic validation
    if (password !== confirmPassword) {
      setError(t.login.passwordsDontMatch || 'Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t.login.passwordTooShort || 'Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Set up authentication
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup',
          username,
          password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Authentication set up successfully! Redirecting to login...');
        
        // Redirect to login after a brief delay
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || 'Failed to set up authentication');
      }
    } catch (err) {
      setError(t.login.authError || 'Authentication setup failed');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t.login.setupAuthTitle || 'Set Up Authentication'}
          </CardTitle>
          <CardDescription>
            {t.login.setupAuthDescription || 'Create your initial username and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.login.username || 'Username'}</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.login.usernamePlaceholder || 'Enter your username'}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t.login.password || 'Password'}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.login.passwordPlaceholder || 'Enter your password'}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.login.confirmPassword || 'Confirm Password'}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.login.confirmPasswordPlaceholder || 'Confirm your password'}
                required
                disabled={loading}
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
              {loading ? (t.login.settingUp || 'Setting up...') : (t.login.setupAuth || 'Set Up Authentication')}
            </Button>
            
            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 mt-4">
              <a
                href="/login"
                className="text-blue-600 hover:underline"
              >
                {t.login.goToLogin || 'Go to Login'}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}