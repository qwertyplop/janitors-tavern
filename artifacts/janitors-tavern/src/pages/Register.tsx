import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Beer, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { register, isAuthenticated, authConfigured, loading: authLoading } = useAuth();

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const forceRegister = params.get('force') === 'true';

  useEffect(() => {
    if (!authLoading && isAuthenticated && authConfigured && !forceRegister) {
      setLocation('/');
    }
  }, [isAuthenticated, authConfigured, authLoading, setLocation, forceRegister]);

  useEffect(() => {
    if (!authLoading && authConfigured && !forceRegister) {
      setLocation('/login');
    }
  }, [authConfigured, authLoading, setLocation, forceRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) { setError('Username is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    const result = await register(username.trim(), password);
    if (result.success) {
      setLocation('/');
    } else {
      setError(result.error || 'Registration failed');
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
          <p className="text-sm text-muted-foreground mt-1">Set up your admin account to protect this instance</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-accent/30 border border-accent-border text-accent-foreground text-xs">
            <ShieldCheck size={14} />
            This is a one-time setup. Your credentials protect the management UI and API.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                required
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
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
              disabled={loading || !username.trim() || !password || !confirmPassword}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Setting up...</>
              ) : (
                <><ShieldCheck size={15} /> Set Up Authentication</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Authentication is optional but recommended if this instance is publicly accessible.
          Skip by leaving auth unconfigured (anyone can access the UI).
        </p>
      </div>
    </div>
  );
}
