import { useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Presets from './pages/Presets';
import Extensions from './pages/Extensions';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import TestStorage from './pages/TestStorage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { storage } from './lib/storage';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authConfigured, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    const isPublicPath = location === '/login' || location === '/register' || location === '/test-storage';
    if (!isAuthenticated && authConfigured && !isPublicPath) {
      const callbackUrl = encodeURIComponent(location);
      setLocation(`/login?callbackUrl=${callbackUrl}`);
    }
    if (!authConfigured && location !== '/register' && !isPublicPath) {
    }
  }, [isAuthenticated, authConfigured, loading, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, authConfigured } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/test-storage" component={TestStorage} />
      <Route>
        {(isAuthenticated || !authConfigured) ? (
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/connections" component={Connections} />
              <Route path="/presets" component={Presets} />
              <Route path="/extensions" component={Extensions} />
              <Route path="/settings" component={Settings} />
              <Route path="/test-storage" component={TestStorage} />
            </Switch>
          </Layout>
        ) : (
          <Login />
        )}
      </Route>
    </Switch>
  );
}

export default function App() {
  useEffect(() => {
    const settings = storage.settings.get();
    const root = document.documentElement;
    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      root.classList.toggle('light', !prefersDark);
    } else if (settings.theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, []);

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </AuthProvider>
    </WouterRouter>
  );
}
