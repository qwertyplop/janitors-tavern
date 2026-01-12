'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
  getSelectedApiKey,
  addApiKeyToConnection,
  updateApiKey,
  deleteApiKey,
  setSelectedApiKey,
  migrateConnectionPresetsToMultiKey,
  getSettings,
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

  // Connection state (for selected connection)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  // Test message state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keyManagementConnectionId, setKeyManagementConnectionId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editKeyName, setEditKeyName] = useState('');
  const [editKeyValue, setEditKeyValue] = useState('');

  // Helper function to get sorted connections
  const getSortedConnections = (): ConnectionPreset[] => {
    const presets = getConnectionPresets();
    return [...presets].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  };

  useEffect(() => {
    // Migrate existing connection presets to multi-key system
    migrateConnectionPresetsToMultiKey();
    
    const sortedPresets = getSortedConnections();
    setConnections(sortedPresets);

    if (sortedPresets.length > 0) {
      // Get settings to check for default connection
      const settings = getSettings();
      const defaultConnectionId = settings.defaultConnectionId;
      
      // Try to find the default connection in the sorted presets
      const defaultConnection = defaultConnectionId
        ? sortedPresets.find(c => c.id === defaultConnectionId)
        : null;
      
      // Set selectedId to default connection if it exists, otherwise first connection
      setSelectedId(defaultConnection?.id || sortedPresets[0].id);
    }
  }, []);

  const selectedConnection = connections.find(c => c.id === selectedId);
  const settings = getSettings();
  const defaultConnectionId = settings.defaultConnectionId;
  const defaultConnection = defaultConnectionId ? connections.find(c => c.id === defaultConnectionId) : null;

  // Select connection for viewing (does not set as default)
  const selectConnection = (id: string) => {
    setSelectedId(id);
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

      // Get selected API key
      const selectedKey = getSelectedApiKey(connection.id);
      const apiKeyValue = selectedKey?.value;

      // Use our server-side proxy to bypass CORS
      const response = await fetch('/api/proxy/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: connection.baseUrl,
          apiKey: apiKeyValue,
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

  // Helper function to format last tested timestamp in user's local time
  const formatLastTestedTime = (timestamp?: string): string | null => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      // Format in user's local timezone
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return null;
    }
  };

  // Test connection by sending "hi!" message through Vercel proxy
  const testConnection = async () => {
    if (!selectedConnection || !selectedModel) {
      setTestResult({ success: false, message: t.connections.selectModelFirst });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      // Get selected API key
      const selectedKey = getSelectedApiKey(selectedConnection.id);
      const apiKey = selectedKey?.value;

      // Use Vercel proxy API to avoid 403 errors from user's IP
      const response = await fetch('/api/proxy/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerType: selectedConnection.providerType,
          baseUrl: selectedConnection.baseUrl,
          apiKey: apiKey,
          model: selectedModel,
          extraHeaders: selectedConnection.extraHeaders,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const responseText = data.message || 'Test successful';
          setTestResult({ success: true, message: `Success: ${responseText.substring(0, 100)}` });
          
          // Update last tested timestamp only on successful tests
          const now = new Date().toISOString();
          updateConnectionPreset(selectedConnection.id, { lastTestedAt: now });
          setConnections(getSortedConnections());
        } else {
          setTestResult({ success: false, message: `Error: ${data.message || 'Test failed'}` });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestResult({
          success: false,
          message: `Error ${response.status}: ${errorData.message || 'Request failed'}`
        });
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
    setConnections(getSortedConnections());
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setIsDialogOpen(true);
  };

  const handleEdit = (connection: ConnectionPreset) => {
    setEditingId(connection.id);
    setFormName(connection.name);
    setFormUrl(connection.baseUrl);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName || !formUrl) return;

    if (editingId) {
      updateConnectionPreset(editingId, {
        name: formName,
        baseUrl: formUrl,
        apiKeyRef: 'local',
      });
    } else {
      const newPreset = addConnectionPreset({
        name: formName,
        baseUrl: formUrl,
        apiKeyRef: 'local',
        providerType: 'openai-compatible',
        model: '',
      });
      selectConnection(newPreset.id);
    }

    setConnections(getSortedConnections());
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteConnectionPreset(id);
    const updated = getSortedConnections();
    setConnections(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    setDeleteConfirmId(null);
  };

  const handleKeyManagement = (connectionId: string) => {
    setKeyManagementConnectionId(connectionId);
    setNewKeyName('');
    setNewKeyValue('');
    setEditingKeyId(null);
  };

  const handleAddKey = () => {
    if (!keyManagementConnectionId || !newKeyName || !newKeyValue) return;
    
    const connection = connections.find(c => c.id === keyManagementConnectionId);
    if (!connection) return;

    try {
      addApiKeyToConnection(keyManagementConnectionId, newKeyName, newKeyValue);
      
      // Update the connections list
      setConnections(getSortedConnections());
      
      // Clear form fields on success
      setNewKeyName('');
      setNewKeyValue('');
      
      // Show success feedback (could add a toast notification here)
      console.log('API key added successfully');
    } catch (error) {
      // Show error to user (could add a toast notification here)
      console.error('Failed to add API key:', error);
      alert(`Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEditKey = (keyId: string) => {
    const connection = connections.find(c => c.id === keyManagementConnectionId);
    if (!connection) return;

    const key = connection.apiKeys?.find(k => k.id === keyId);
    if (!key) return;

    setEditingKeyId(keyId);
    setEditKeyName(key.name);
    setEditKeyValue(key.value);
  };

  const handleSaveEditKey = () => {
    if (!keyManagementConnectionId || !editingKeyId || !editKeyName || !editKeyValue) return;

    try {
      updateApiKey(keyManagementConnectionId, editingKeyId, {
        name: editKeyName,
        value: editKeyValue,
      });

      setConnections(getSortedConnections());
      setEditingKeyId(null);
      setEditKeyName('');
      setEditKeyValue('');
      
      console.log('API key updated successfully');
    } catch (error) {
      console.error('Failed to update API key:', error);
      alert(`Failed to update API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteKey = (keyId: string) => {
    if (!keyManagementConnectionId) return;
    deleteApiKey(keyManagementConnectionId, keyId);
    setConnections(getSortedConnections());
  };

  const handleSelectKey = (keyId: string) => {
    if (!keyManagementConnectionId) return;
    setSelectedApiKey(keyManagementConnectionId, keyId);
    setConnections(getSortedConnections());
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
      setConnections(getSortedConnections());
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
          <Button onClick={handleCreate}>{t.connections.newConnection}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Connection List */}
        <div className="lg:col-span-1 space-y-2">
          {/* Active Profile Section */}
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              {t.connections.activeProfile}
            </h2>
            {defaultConnection ? (
              <Card
                className="p-3 border-green-500 bg-green-50 dark:bg-green-950 cursor-pointer transition-colors"
                onClick={() => selectConnection(defaultConnection.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{defaultConnection.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {defaultConnection.baseUrl}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKeyManagement(defaultConnection.id);
                      }}
                      title={t.connections.manageApiKeys}
                    >
                      🔑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(defaultConnection);
                      }}
                      title={t.connections.editConnection}
                    >
                      ✎
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(defaultConnection.id);
                      }}
                      title={t.common.delete}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                  {t.connections.noConnectionsYet}
                </p>
              </Card>
            )}
          </div>

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
                  onClick={() => selectConnection(connection.id)}
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
                          handleKeyManagement(connection.id);
                        }}
                        title={t.connections.manageApiKeys}
                      >
                        🔑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(connection);
                        }}
                        title={t.connections.editConnection}
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
                        title={t.common.delete}
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

                {/* Key Management */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.connections.apiKeyManagement}
                  </h3>
                  {selectedConnection && (() => {
                    const apiKeys = selectedConnection.apiKeys || [];
                    const selectedKeyId = selectedConnection.selectedKeyId;
                    const selectedKey = apiKeys.find(k => k.id === selectedKeyId);
                    
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {apiKeys.length === 0 ? (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {t.connections.noApiKeysConfigured}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{t.connections.selectedKey}</span>
                                  {selectedKey ? (
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                      {selectedKey.name}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                                      {t.connections.noKeySelected}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {apiKeys.map((key) => (
                                    <div
                                      key={key.id}
                                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                                        selectedKeyId === key.id
                                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 cursor-default'
                                          : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer'
                                      }`}
                                      onClick={() => {
                                        if (selectedKeyId !== key.id && selectedConnection) {
                                          setSelectedApiKey(selectedConnection.id, key.id);
                                          setConnections(getSortedConnections());
                                        }
                                      }}
                                    >
                                      {key.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleKeyManagement(selectedConnection.id)}
                          >
                            {t.connections.manageKeys}
                          </Button>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t.connections.apiKeyManagementHint}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.connections.modelSelection}
                  </h3>
                  <div className="flex items-center gap-3">
                    {availableModels.length > 0 ? (
                      <SearchableSelect
                        value={selectedModel}
                        onChange={setSelectedModel}
                        options={availableModels.map(model => ({
                          value: model.id,
                          label: model.id
                        }))}
                        placeholder={t.connections.selectModel}
                        searchPlaceholder={t.common.select}
                        className="flex-1"
                      />
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
                  <div className="flex flex-col gap-1">
                    {selectedConnection?.lastTestedAt && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t.connections.lastTested} {formatLastTestedTime(selectedConnection.lastTestedAt)}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">
                      {t.connections.testHint}
                    </p>
                  </div>
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
                placeholder={t.common.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">{t.connections.apiUrl}</Label>
              <Input
                id="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder={t.connections.apiUrl}
              />
              <p className="text-xs text-zinc-500">
                {t.connections.apiUrlHint}
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

      {/* Key Management Dialog */}
      <Dialog open={!!keyManagementConnectionId} onOpenChange={() => setKeyManagementConnectionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.connections.apiKeyManagement}</DialogTitle>
          </DialogHeader>
          {keyManagementConnectionId && (() => {
            const connection = connections.find(c => c.id === keyManagementConnectionId);
            if (!connection) return null;
            const apiKeys = connection.apiKeys || [];
            const selectedKeyId = connection.selectedKeyId;
            
            return (
              <div className="space-y-6 py-4">
                {/* Current connection info */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                      {t.connections.existingApiKeys}
                    </h3>
                    {apiKeys.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {t.connections.noApiKeysAddedYet}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {apiKeys.map((key) => (
                          <div
                            key={key.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              selectedKeyId === key.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 cursor-default'
                                : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer'
                            }`}
                            onClick={(e) => {
                              // Only trigger selection if clicking on the block itself (not buttons)
                              if (!(e.target instanceof HTMLButtonElement) &&
                                  !(e.target as HTMLElement).closest('button') &&
                                  selectedKeyId !== key.id) {
                                handleSelectKey(key.id);
                              }
                            }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{key.name}</span>
                                {selectedKeyId === key.id && (
                                  <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">
                                    {t.connections.selectedBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {key.value.substring(0, 20)}...
                              </p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                Created: {new Date(key.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectKey(key.id);
                                }}
                                disabled={selectedKeyId === key.id}
                              >
                                {t.common.select}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditKey(key.id);
                                }}
                              >
                                {t.common.edit}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteKey(key.id);
                                }}
                              >
                                {t.common.delete}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add new key form */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {editingKeyId ? t.connections.editKey : t.connections.addNewKey}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="keyName">{t.connections.keyName}</Label>
                        <Input
                          id="keyName"
                          value={editingKeyId ? editKeyName : newKeyName}
                          onChange={(e) => editingKeyId ? setEditKeyName(e.target.value) : setNewKeyName(e.target.value)}
                          placeholder={t.connections.keyNamePlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="keyValue">{t.connections.keyValue}</Label>
                        <Input
                          id="keyValue"
                          type="password"
                          value={editingKeyId ? editKeyValue : newKeyValue}
                          onChange={(e) => editingKeyId ? setEditKeyValue(e.target.value) : setNewKeyValue(e.target.value)}
                          placeholder={t.connections.keyValuePlaceholder}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingKeyId ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingKeyId(null);
                              setEditKeyName('');
                              setEditKeyValue('');
                            }}
                          >
                            {t.common.cancel}
                          </Button>
                          <Button
                            onClick={handleSaveEditKey}
                            disabled={!editKeyName || !editKeyValue}
                          >
                            {t.connections.saveChanges}
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={handleAddKey}
                          disabled={!newKeyName || !newKeyValue}
                        >
                          {t.connections.addKey}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyManagementConnectionId(null)}>
              {t.connections.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
