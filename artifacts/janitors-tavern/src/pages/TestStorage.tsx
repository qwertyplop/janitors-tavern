import { useState } from 'react';
import { FlaskConical, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { storage } from '@/lib/storage';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/i18n';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
}

export default function TestStorage() {
  const lang = useLang();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setDone(false);
    const r: TestResult[] = [];

    const add = (name: string, status: 'pass' | 'fail', message: string) => {
      r.push({ name, status, message });
    };

    try {
      const testKey = 'jt._test';
      const testValue = { ts: Date.now() };
      localStorage.setItem(testKey, JSON.stringify(testValue));
      const readBack = JSON.parse(localStorage.getItem(testKey) || 'null');
      localStorage.removeItem(testKey);
      if (readBack && readBack.ts === testValue.ts) {
        add('localStorage read/write', 'pass', 'localStorage is working correctly.');
      } else {
        add('localStorage read/write', 'fail', 'Read value did not match written value.');
      }
    } catch (e) {
      add('localStorage read/write', 'fail', `Error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const before = storage.connections.getAll().length;
      const testId = `_test_${Date.now()}`;
      storage.connections.upsert({
        id: testId, name: 'Test', providerType: 'openai-compatible', baseUrl: 'https://test.com',
        apiKeyRef: 'local', apiKeys: [], model: 'test-model', promptPostProcessing: 'none',
        bypassStatusCheck: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      const after = storage.connections.getAll().length;
      storage.connections.delete(testId);
      const final = storage.connections.getAll().length;
      if (after === before + 1 && final === before) {
        add('Storage CRUD (connections)', 'pass', 'Create and delete operations work correctly.');
      } else {
        add('Storage CRUD (connections)', 'fail', 'CRUD operations did not produce expected counts.');
      }
    } catch (e) {
      add('Storage CRUD (connections)', 'fail', `Error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const res = await fetch('/api/healthz');
      const data = await res.json() as { status: string };
      if (res.ok && data.status === 'ok') {
        add('API server health check', 'pass', 'API server is reachable and healthy.');
      } else {
        add('API server health check', 'fail', `Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      add('API server health check', 'fail', `Error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const statsData = await api.stats.get();
      if (statsData.stats && typeof statsData.stats.totalRequests === 'number') {
        add('Stats API endpoint', 'pass', `Stats working. Total requests: ${statsData.stats.totalRequests}`);
      } else {
        add('Stats API endpoint', 'fail', 'Stats response missing expected fields.');
      }
    } catch (e) {
      add('Stats API endpoint', 'fail', `Error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const exported = storage.exportAll();
      const parsed = JSON.parse(exported);
      if (parsed.version && Array.isArray(parsed.connections) && Array.isArray(parsed.presets)) {
        add('Data export/import', 'pass', `Export works. ${parsed.connections.length} connections, ${parsed.presets.length} presets exported.`);
      } else {
        add('Data export/import', 'fail', 'Export data missing expected fields.');
      }
    } catch (e) {
      add('Data export/import', 'fail', `Error: ${e instanceof Error ? e.message : String(e)}`);
    }

    setResults(r);
    setRunning(false);
    setDone(true);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t(lang, 'diagnosticsTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t(lang, 'diagnosticsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{results.length}</div>
          <div className="text-xs text-muted-foreground">{t(lang, 'testsLabel')}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className={cn('text-2xl font-bold', done && passCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>{passCount}</div>
          <div className="text-xs text-muted-foreground">{t(lang, 'passedLabel')}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className={cn('text-2xl font-bold', failCount > 0 ? 'text-destructive' : 'text-foreground')}>{failCount}</div>
          <div className="text-xs text-muted-foreground">{t(lang, 'failedLabel')}</div>
        </div>
      </div>

      <button
        onClick={runTests}
        disabled={running}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {running
          ? <><RefreshCw size={15} className="animate-spin" /> {t(lang, 'runningTests')}</>
          : <><FlaskConical size={15} /> {t(lang, 'runDiagnostics')}</>
        }
      </button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result, i) => (
            <div key={i} className={cn('flex items-start gap-3 p-4 rounded-xl border', result.status === 'pass' ? 'bg-green-500/5 border-green-500/25' : 'bg-destructive/5 border-destructive/25')}>
              {result.status === 'pass'
                ? <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                : <XCircle size={16} className="text-destructive mt-0.5 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{result.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{result.message}</div>
              </div>
              <span className={cn('text-xs font-semibold shrink-0', result.status === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
                {result.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <div className={cn('px-4 py-3 rounded-xl border text-sm font-medium', failCount === 0 ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' : 'bg-destructive/10 border-destructive/30 text-destructive')}>
          {failCount === 0
            ? t(lang, 'allTestsPassed', { count: passCount })
            : t(lang, 'someTestsFailed', { count: failCount })
          }
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-4 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">{t(lang, 'storageArchTitle')}</h3>
        <div className="space-y-1 text-xs">
          <div><span className="text-foreground font-medium">{t(lang, 'storageClientData')}</span> {t(lang, 'storageClientDataDesc')}</div>
          <div><span className="text-foreground font-medium">{t(lang, 'storageServerState')}</span> {t(lang, 'storageServerStateDesc')}</div>
          <div><span className="text-foreground font-medium">{t(lang, 'storageAuthCreds')}</span> {t(lang, 'storageAuthCredsDesc')}</div>
          <div><span className="text-foreground font-medium">{t(lang, 'storageNoFirebase')}</span> {t(lang, 'storageNoFirebaseDesc')}</div>
        </div>
      </div>
    </div>
  );
}
