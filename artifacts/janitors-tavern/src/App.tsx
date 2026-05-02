import { useEffect } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Presets from './pages/Presets';
import Extensions from './pages/Extensions';
import Settings from './pages/Settings';
import { storage } from './lib/storage';

function App() {
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
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/connections" component={Connections} />
          <Route path="/presets" component={Presets} />
          <Route path="/extensions" component={Extensions} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </Layout>
    </WouterRouter>
  );
}

export default App;
