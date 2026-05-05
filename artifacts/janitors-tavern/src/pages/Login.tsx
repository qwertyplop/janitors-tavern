import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Beer, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/i18n';

export default function Login() {
  const lang = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, authConfigured, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated && authConfigured) {
      setLocation('/');
    }
  }, [isAuthenticated, authConfigured, authLoading, setLocation]);

  useEffect(() => {
    if (!authLoading && !authConfigured) {
      setLocation('/register');
    }
  }, [authConfigured, authLoading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    const result = await login(username.trim(), password);
    if (result.success) {
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get('callbackUrl') || '/';
      setLocation(callbackUrl);
    } else {
      setError(result.error || 'Invalid credentials');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
            <Beer size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Janitor's Tavern</h1>
          <p className="text-sm text-muted-foreground mt-1">{t(lang, 'signInTitle')}</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t(lang, 'username')}</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t(lang, 'usernameLoginHint')}
                autoComplete="username"
                required
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t(lang, 'password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t(lang, 'passwordLoginHint')}
                autoComplete="current-password"
                required
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> {t(lang, 'signingIn')}</>
              ) : (
                <><LogIn size={15} /> {t(lang, 'signIn')}</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {t(lang, 'proxyAccessNote')}
        </p>
      </div>
    </div>
  );
}
