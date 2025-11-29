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
} from '@/lib/storage';
import { ConnectionPreset } from '@/types';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const [dots, setDots] = useState(0);

  // Animate dots for connecting status
  useEffect(() => {
    if (status !== 'connecting') return;

    const interval = setInterval(() => {
      setDots(d => (d + 1) % 4);
    }, 400);

    return () => clearInterval(interval);
  }, [status]);

  const config = {
    none: { color: 'bg-red-500', label: 'No connection' },
    connecting: { color: 'bg-amber-500', label: `Connecting${'.'.repeat(dots || 1)}` },
    bypassed: { color: 'bg-amber-500', label: 'Status Check Bypassed' },
    valid: { color: 'bg-green-500', label: 'Valid' },
  };

  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-zinc-600 dark:text-zinc-400 min-w-[140px]">{label}</span>
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

  // Auto-connect state
  const [autoConnectId, setAutoConnectId] = useState<string | null>(null);
  const autoConnectTriggered = useRef(false);

  useEffect(() => {
    const presets = getConnectionPresets();
    setConnections(presets);

    // Load auto-connect setting
    const savedAutoConnectId = localStorage.getItem('jt.autoConnectId');
    if (savedAutoConnectId && presets.some(p => p.id === savedAutoConnectId)) {
      setAutoConnectId(savedAutoConnectId);
      setSelectedId(savedAutoConnectId);

      // Trigger auto-connect
      if (!autoConnectTriggered.current) {
        autoConnectTriggered.current = true;
        const connectionToConnect = presets.find(p => p.id === savedAutoConnectId);
        if (connectionToConnect) {
          // Delay to allow state to settle
          setTimeout(() => {
            connectToPresetDirect(connectionToConnect);
          }, 300);
        }
      }
    } else if (presets.length > 0) {
      // Auto-select first connection if available
      setSelectedId(presets[0].id);
    }
  }, []);

  const selectedConnection = connections.find(c => c.id === selectedId);

  // Reset connection state when selection changes (but not during initial auto-connect)
  useEffect(() => {
    if (autoConnectTriggered.current && autoConnectId === selectedId) {
      // Don't reset during auto-connect
      return;
    }
    setConnectionStatus('none');
    setAvailableModels([]);
    setSelectedModel(selectedConnection?.model || '');
    setTestResult(null);
  }, [selectedId]);

  // Toggle auto-connect for current connection
  const toggleAutoConnect = () => {
    if (autoConnectId === selectedId) {
      // Disable auto-connect
      setAutoConnectId(null);
      localStorage.removeItem('jt.autoConnectId');
    } else if (selectedId) {
      // Enable auto-connect for this connection
      setAutoConnectId(selectedId);
      localStorage.setItem('jt.autoConnectId', selectedId);
    }
  };

  // Connect handler - fetches models and updates status (direct version for auto-connect)
  const connectToPresetDirect = async (connection: ConnectionPreset) => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setAvailableModels([]);
    setSelectedModel(connection.model || '');

    try {
      // Normalize the base URL
      let modelsUrl = connection.baseUrl.replace(/\/+$/, '');
      if (!modelsUrl.endsWith('/v1')) {
        modelsUrl += '/v1';
      }
      modelsUrl += '/models';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const apiKey = connection.apiKeyLocalEncrypted;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(modelsUrl, { headers });

      if (response.ok) {
        const data: ModelsResponse = await response.json();
        if (data.data && data.data.length > 0) {
          setAvailableModels(data.data);
          setConnectionStatus('valid');
          // Keep saved model selected if it exists in the list
          if (connection.model && data.data.some(m => m.id === connection.model)) {
            setSelectedModel(connection.model);
          }
        } else if (connection.bypassStatusCheck) {
          setConnectionStatus('bypassed');
        } else {
          setConnectionStatus('none');
        }
      } else {
        if (connection.bypassStatusCheck) {
          setConnectionStatus('bypassed');
        } else {
          setConnectionStatus('none');
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
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
      setTestResult({ success: false, message: 'Please select a model first' });
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
      setSelectedId(newPreset.id);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage API connection presets for different providers
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={connections.length === 0}>
            Export All
          </Button>
          <Button onClick={handleCreate}>New Connection</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Panel - Connection List */}
        <div className="col-span-1 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Saved Connections
          </h2>
          {connections.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                No connections yet
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
                  onClick={() => setSelectedId(connection.id)}
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
        <div className="col-span-2">
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
                    Connection
                  </h3>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                    <StatusIndicator status={connectionStatus} />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={toggleAutoConnect}
                      className={cn(
                        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        autoConnectId === selectedId ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
                      )}
                      role="switch"
                      aria-checked={autoConnectId === selectedId}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          autoConnectId === selectedId ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                    <Label className="text-sm cursor-pointer" onClick={toggleAutoConnect}>
                      Auto-Connect on Launch
                    </Label>
                    {autoConnectId === selectedId && (
                      <span className="text-xs text-green-600 dark:text-green-400">Enabled</span>
                    )}
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    Model Selection
                  </h3>
                  <div className="flex items-center gap-3">
                    {availableModels.length > 0 ? (
                      <Select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="flex-1"
                      >
                        <option value="">Select a model...</option>
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
                        placeholder="Enter model ID or click Connect to fetch"
                        className="flex-1"
                      />
                    )}
                    <Button
                      variant="outline"
                      onClick={handleSaveModel}
                      disabled={!selectedModel}
                    >
                      Save Model
                    </Button>
                  </div>
                  {selectedConnection.model && (
                    <p className="text-xs text-zinc-500">
                      Saved model: {selectedConnection.model}
                    </p>
                  )}
                </div>

                {/* Test Connection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    Test Connection
                  </h3>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={testConnection}
                      disabled={!selectedModel || isTestingConnection}
                    >
                      {isTestingConnection ? 'Testing...' : 'Test Message'}
                    </Button>
                    {testResult && (
                      <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.message}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Sends &quot;hi!&quot; to verify the connection works.
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(selectedConnection)}
                  >
                    Edit Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(selectedConnection)}
                  >
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 flex items-center justify-center">
              <div className="text-center">
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                  {connections.length === 0
                    ? 'Create a connection to get started'
                    : 'Select a connection from the list'}
                </p>
                {connections.length === 0 && (
                  <Button onClick={handleCreate}>New Connection</Button>
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
            <DialogTitle>{editingId ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My API Connection"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">API URL</Label>
              <Input
                id="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-xs text-zinc-500">
                Base URL for the API. Do not include /chat/completions.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-zinc-500">
                Your API key will be stored locally in the browser.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName || !formUrl}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete this connection? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
