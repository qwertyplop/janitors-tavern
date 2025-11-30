'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  getConnectionPresets,
  addConnectionPreset,
  updateConnectionPreset,
  deleteConnectionPreset,
  saveConnectionPresets,
  generateId,
  updateSettings,
} from '@/lib/storage';
import { ConnectionPreset } from '@/types';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/I18nProvider';

type ConnectionStatus = 'none' | 'connecting' | 'bypassed' | 'valid';

interface ModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
}

interface ModelsResponse {
  data: ModelInfo[];
  object?: string;
}

function StatusIndicator({ status, t }: { status: ConnectionStatus; t: ReturnType<typeof useI18n>['t'] }) {
  const [dots, setDots] = useState(0);

  // Animate dots for connecting status
  useEffect(() => {
    if (status !== 'connecting') return;

    const interval = setInterval(() => {
      setDots(d => (d + 1) % 4);
    }, 400);

    return () => clearInterval(interval);
  }, [status]);

  const getLabel = () => {
    switch (status) {
      case 'none': return t.connections.statusNoConnection;
      case 'connecting': return `${t.connections.statusConnecting}${'.'.repeat(dots || 1)}`;
      case 'bypassed': return t.connections.statusBypassed;
      case 'valid': return t.connections.statusValid;
    }
  };

  const color = {
    none: 'bg-red-500',
    connecting: 'bg-amber-500',
    bypassed: 'bg-amber-500',
    valid: 'bg-green-500',
  }[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-zinc-600 dark:text-zinc-400 min-w-[140px]">{getLabel()}</span>
    </div>
  );
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  // Form state for create/edit dialog
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');

  // Connection state (for selected connection)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  // Test message state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const presets = getConnectionPresets();
    setConnections(presets);

    if (presets.length > 0) {
      setSelectedId(presets[0].id);
    }
  }, []);

  const selectedConnection = connections.find(c => c.id === selectedId);

  // Set selected connection as default
  const selectAndSetDefault = (id: string) => {
    setSelectedId(id);
    // Also update settings to make this the default connection
    updateSettings({ defaultConnectionId: id });
  };

  // Reset connection state when selection changes
  useEffect(() => {
    setConnectionStatus('none');
    setAvailableModels([]);
    setSelectedModel(selectedConnection?.model || '');
    setTestResult(null);
  }, [selectedId]);

  // Connect handler - fetches models via server-side proxy to bypass CORS
  const connectToPresetDirect = async (connection: ConnectionPreset) => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setAvailableModels([]);
    setSelectedModel(connection.model || '');

    try {
      console.log('[Connections] Fetching models via proxy for:', connection.baseUrl);

      // Use our server-side proxy to bypass CORS
      const response = await fetch('/api/proxy/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKeyLocalEncrypted,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Connections] Models response:', data);

        const models: ModelInfo[] = data.models || [];

        if (models.length > 0) {
          setAvailableModels(models);
          setConnectionStatus('valid');
          // Keep saved model selected if it exists in the list
          if (connection.model && models.some(m => m.id === connection.model)) {
            setSelectedModel(connection.model);
          }
        } else if (connection.bypassStatusCheck) {
          setConnectionStatus('bypassed');
        } else {
          // No models found but connection worked - still valid, user can enter model manually
          setConnectionStatus('valid');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('[Connections] Models request failed:', response.status, errorData);
        if (connection.bypassStatusCheck) {
          setConnectionStatus('bypassed');
        } else {
          setConnectionStatus('none');
        }
      }
    } catch (error) {
      console.error('[Connections] Connection error:', error);
      if (connection.bypassStatusCheck) {
        setConnectionStatus('bypassed');
      } else {
        setConnectionStatus('none');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Button click handler
  const handleConnect = () => {
    if (selectedConnection) {
      connectToPresetDirect(selectedConnection);
    }
  };

  // Test connection by sending "hi!" message
  const testConnection = async () => {
    if (!selectedConnection || !selectedModel) {
      setTestResult({ success: false, message: t.connections.selectModelFirst });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      let chatUrl = selectedConnection.baseUrl.replace(/\/+$/, '');
      if (!chatUrl.endsWith('/v1')) {
        chatUrl += '/v1';
      }
      chatUrl += '/chat/completions';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const apiKey = selectedConnection.apiKeyLocalEncrypted;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const testPayload = {
        model: selectedModel,
        messages: [{ role: 'user', content: 'hi!' }],
        max_tokens: 50,
      };

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || 'Response received';
        setTestResult({ success: true, message: `Success: ${responseText.substring(0, 100)}` });
      } else {
        const errorText = await response.text();
        setTestResult({ success: false, message: `Error ${response.status}: ${errorText.substring(0, 100)}` });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save selected model to the connection preset
  const handleSaveModel = () => {
    if (!selectedConnection || !selectedModel) return;
    updateConnectionPreset(selectedConnection.id, { model: selectedModel });
    setConnections(getConnectionPresets());
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormApiKey('');
    setIsDialogOpen(true);
  };

  const handleEdit = (connection: ConnectionPreset) => {
    setEditingId(connection.id);
    setFormName(connection.name);
    setFormUrl(connection.baseUrl);
    setFormApiKey(connection.apiKeyLocalEncrypted || '');
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName || !formUrl) return;

    if (editingId) {
      updateConnectionPreset(editingId, {
        name: formName,
        baseUrl: formUrl,
        apiKeyLocalEncrypted: formApiKey || undefined,
        apiKeyRef: 'local',
      });
    } else {
      const newPreset = addConnectionPreset({
        name: formName,
        baseUrl: formUrl,
        apiKeyLocalEncrypted: formApiKey || undefined,
        apiKeyRef: 'local',
        providerType: 'openai-compatible',
        model: '',
      });
      selectAndSetDefault(newPreset.id);
    }

    setConnections(getConnectionPresets());
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteConnectionPreset(id);
    const updated = getConnectionPresets();
    setConnections(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    setDeleteConfirmId(null);
  };

  const handleExport = (connection: ConnectionPreset) => {
    const exportData = { ...connection, apiKeyLocalEncrypted: undefined };
    downloadJson(exportData, `connection-${connection.name.replace(/\s+/g, '-').toLowerCase()}.json`);
  };

  const handleExportAll = () => {
    const exportData = connections.map(c => ({ ...c, apiKeyLocalEncrypted: undefined }));
    downloadJson(exportData, 'connections-export.json');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readJsonFile<ConnectionPreset | ConnectionPreset[]>(file);
      const presetsToImport = Array.isArray(data) ? data : [data];
      const now = new Date().toISOString();

      const newPresets = presetsToImport.map((p) => ({
        ...p,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        providerType: p.providerType || 'openai-compatible',
        apiKeyRef: p.apiKeyRef || 'local',
        promptPostProcessing: p.promptPostProcessing || 'none',
        bypassStatusCheck: p.bypassStatusCheck || false,
      })) as ConnectionPreset[];

      const existingPresets = getConnectionPresets();
      saveConnectionPresets([...existingPresets, ...newPresets]);
      setConnections(getConnectionPresets());
    } catch (error) {
      console.error('Import failed:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t.connections.title}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t.connections.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            {t.common.import}
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={connections.length === 0}>
            {t.common.exportAll}
          </Button>
          <Button onClick={handleCreate}>{t.connections.newConnection}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Connection List */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            {t.connections.savedConnections}
          </h2>
          {connections.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                {t.connections.noConnectionsYet}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <Card
                  key={connection.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors',
                    selectedId === connection.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                  onClick={() => selectAndSetDefault(connection.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{connection.name}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {connection.baseUrl}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(connection);
                        }}
                      >
                        ✎
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(connection.id);
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Connection Details & Actions */}
        <div className="lg:col-span-2">
          {selectedConnection ? (
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">{selectedConnection.name}</CardTitle>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedConnection.baseUrl}
                </p>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Connect Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.connections.connectionSection}
                  </h3>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                      {isConnecting ? t.connections.connecting : t.connections.connect}
                    </Button>
                    <StatusIndicator status={connectionStatus} t={t} />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.connections.connectHint}
                  </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.connections.modelSelection}
                  </h3>
                  <div className="flex items-center gap-3">
                    {availableModels.length > 0 ? (
                      <Select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="flex-1"
                      >
                        <option value="">{t.connections.selectModel}</option>
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.id}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        placeholder={t.connections.enterModelId}
                        className="flex-1"
                      />
                    )}
                    <Button
                      variant="outline"
                      onClick={handleSaveModel}
                      disabled={!selectedModel}
                    >
                      {t.connections.saveModel}
                    </Button>
                  </div>
                  {selectedConnection.model && (
                    <p className="text-xs text-zinc-500">
                      {t.connections.savedModel} {selectedConnection.model}
                    </p>
                  )}
                </div>

                {/* Test Connection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.connections.testConnection}
                  </h3>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={testConnection}
                      disabled={!selectedModel || isTestingConnection}
                    >
                      {isTestingConnection ? t.connections.testing : t.connections.testMessage}
                    </Button>
                    {testResult && (
                      <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.message}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t.connections.testHint}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(selectedConnection)}
                  >
                    {t.connections.editConnection}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(selectedConnection)}
                  >
                    {t.common.export}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 flex items-center justify-center">
              <div className="text-center">
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                  {connections.length === 0
                    ? t.connections.createConnection
                    : t.connections.selectFromList}
                </p>
                {connections.length === 0 && (
                  <Button onClick={handleCreate}>{t.connections.newConnection}</Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog - Simplified */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t.connections.editConnectionTitle : t.connections.newConnectionTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.common.name}</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My API Connection"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">{t.connections.apiUrl}</Label>
              <Input
                id="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-zinc-500">
                {t.connections.apiUrlHint}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t.connections.apiKey}</Label>
              <Input
                id="apiKey"
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-zinc-500">
                {t.connections.apiKeyHint}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={!formName || !formUrl}>
              {editingId ? t.common.save : t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.connections.deleteConnection}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t.connections.deleteConnectionConfirm}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
