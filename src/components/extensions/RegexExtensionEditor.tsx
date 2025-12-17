'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RegexScript } from '@/types';
import { useI18n } from '@/components/providers/I18nProvider';

interface RegexExtensionEditorProps {
  extensionId?: string;
  onSave?: (extension: any) => void;
  onCancel?: () => void;
}

export function RegexExtensionEditor({
  extensionId,
  onSave,
  onCancel
}: RegexExtensionEditorProps) {
  const { t } = useI18n();
  const [scripts, setScripts] = useState<RegexScript[]>([]);
  const [extensionName, setExtensionName] = useState('');
  const [extensionDescription, setExtensionDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing extension if editing
  useEffect(() => {
    if (extensionId) {
      loadExtension(extensionId);
    } else {
      // Initialize with default values for new extension
      setExtensionName('Regex Processor');
      setExtensionDescription('Processes chat history using regex patterns');
    }
  }, [extensionId]);

  const loadExtension = async (id: string) => {
    try {
      setIsLoading(true);
      // TODO: Implement actual loading from storage/API
      // This is a placeholder for the actual implementation
      console.log('Loading extension:', id);
      setExtensionName('Regex Processor');
      setExtensionDescription('Processes chat history using regex patterns');
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load extension');
      setIsLoading(false);
    }
  };

  const addNewScript = () => {
    const newScript: RegexScript = {
      id: `script-${Date.now()}`,
      name: 'New Regex Script',
      description: '',
      pattern: '',
      replacement: '',
      flags: 'g',
      enabled: true,
      order: scripts.length
    };
    setScripts([...scripts, newScript]);
  };

  const updateScript = (id: string, updates: Partial<RegexScript>) => {
    setScripts(scripts.map(script =>
      script.id === id ? { ...script, ...updates } : script
    ));
  };

  const removeScript = (id: string) => {
    setScripts(scripts.filter(script => script.id !== id));
  };

  const toggleScript = (id: string) => {
    updateScript(id, { enabled: !scripts.find(s => s.id === id)?.enabled });
  };

  const moveScriptUp = (id: string) => {
    const index = scripts.findIndex(s => s.id === id);
    if (index > 0) {
      const newScripts = [...scripts];
      [newScripts[index - 1], newScripts[index]] = [newScripts[index], newScripts[index - 1]];
      setScripts(newScripts);
    }
  };

  const moveScriptDown = (id: string) => {
    const index = scripts.findIndex(s => s.id === id);
    if (index < scripts.length - 1) {
      const newScripts = [...scripts];
      [newScripts[index], newScripts[index + 1]] = [newScripts[index + 1], newScripts[index]];
      setScripts(newScripts);
    }
  };

  const handleSave = () => {
    if (!extensionName.trim()) {
      setError('Extension name is required');
      return;
    }

    const extensionConfig = {
      id: extensionId || `regex-${Date.now()}`,
      name: extensionName,
      description: extensionDescription,
      type: 'regex' as const,
      config: {
        scripts: scripts.map((script, index) => ({
          ...script,
          order: index
        })),
        enabledScripts: scripts.filter(s => s.enabled).map(s => s.id)
      },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave?.(extensionConfig);
  };

  const importScriptsFromJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);

            // Validate SillyTavern format
            if (!parsed.scriptName || !parsed.findRegex) {
              setError('Invalid format. Expected SillyTavern regex script format with scriptName and findRegex properties.');
              return;
            }

            // Convert ST format to our internal format
            const importedScript: RegexScript = {
              id: parsed.id || `imported-${Date.now()}`,
              name: parsed.scriptName,
              description: parsed.description || '',
              pattern: parsed.findRegex,
              replacement: parsed.replaceString || '',
              flags: 'g', // Default flag
              enabled: parsed.disabled !== true,
              order: scripts.length
            };

            setScripts([...scripts, importedScript]);
          } catch (err) {
            setError('Failed to parse JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const exportScriptsToJson = () => {
    // Convert our internal format to SillyTavern format for export
    const stFormatScripts = scripts.map(script => ({
      id: script.id,
      scriptName: script.name,
      description: script.description,
      findRegex: script.pattern,
      replaceString: script.replacement,
      disabled: !script.enabled,
      // Include other common ST properties
      trimStrings: [],
      placement: [2],
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: true,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null
    }));

    const jsonContent = JSON.stringify(stFormatScripts, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extensionName.toLowerCase().replace(/\s+/g, '-')}-scripts.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{extensionId ? t.extensions.editRegexExtension : t.extensions.createRegexExtension}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.extensions.regexExtensionDescription}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.extensions.extensionSettings}</CardTitle>
          <CardDescription>{t.extensions.configureExtension}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="extension-name">{t.extensions.extensionName}</Label>
            <Input
              id="extension-name"
              value={extensionName}
              onChange={(e) => setExtensionName(e.target.value)}
              placeholder={t.extensions.extensionNamePlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-description">{t.extensions.extensionDescription}</Label>
            <Textarea
              id="extension-description"
              value={extensionDescription}
              onChange={(e) => setExtensionDescription(e.target.value)}
              placeholder={t.extensions.extensionDescriptionPlaceholder}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t.extensions.regexScripts}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={importScriptsFromJson}>
                {t.extensions.import}
              </Button>
              <Button variant="outline" size="sm" onClick={exportScriptsToJson}>
                {t.extensions.export}
              </Button>
              <Button size="sm" onClick={addNewScript}>
                {t.extensions.addScript}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>{t.extensions.manageRegexScripts}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-500">
              <p>{t.extensions.noScriptsAdded}</p>
              <Button className="mt-4" size="sm" onClick={addNewScript}>
                {t.extensions.addFirstScript}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {scripts.map((script, index) => (
                <Card key={script.id} className="border border-zinc-200 dark:border-zinc-800">
                  <CardHeader className="flex flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Button
                        variant={script.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleScript(script.id)}
                      >
                        {script.enabled ? t.common.enabled : t.common.disabled}
                      </Button>
                      <div>
                        <h4 className="font-medium">{script.name || `Script ${index + 1}`}</h4>
                        {script.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{script.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {t.extensions.order}: {index + 1}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveScriptUp(script.id)}
                          disabled={index === 0}
                        >
                          <span className="sr-only">{t.extensions.moveUp}</span>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveScriptDown(script.id)}
                          disabled={index === scripts.length - 1}
                        >
                          <span className="sr-only">{t.extensions.moveDown}</span>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => removeScript(script.id)}
                        >
                          <span className="sr-only">{t.extensions.remove}</span>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor={`script-name-${script.id}`}>{t.extensions.scriptName}</Label>
                      <Input
                        id={`script-name-${script.id}`}
                        value={script.name}
                        onChange={(e) => updateScript(script.id, { name: e.target.value })}
                        placeholder={t.extensions.scriptNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`script-description-${script.id}`}>{t.extensions.scriptDescription}</Label>
                      <Textarea
                        id={`script-description-${script.id}`}
                        value={script.description}
                        onChange={(e) => updateScript(script.id, { description: e.target.value })}
                        placeholder={t.extensions.scriptDescriptionPlaceholder}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`script-pattern-${script.id}`}>{t.extensions.regexPattern}</Label>
                      <Textarea
                        id={`script-pattern-${script.id}`}
                        value={script.pattern}
                        onChange={(e) => updateScript(script.id, { pattern: e.target.value })}
                        placeholder={t.extensions.regexPatternPlaceholder}
                        rows={3}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`script-replacement-${script.id}`}>{t.extensions.replacementText}</Label>
                      <Textarea
                        id={`script-replacement-${script.id}`}
                        value={script.replacement}
                        onChange={(e) => updateScript(script.id, { replacement: e.target.value })}
                        placeholder={t.extensions.replacementTextPlaceholder}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`script-flags-${script.id}`}>{t.extensions.regexFlags}</Label>
                      <Input
                        id={`script-flags-${script.id}`}
                        value={script.flags}
                        onChange={(e) => updateScript(script.id, { flags: e.target.value })}
                        placeholder="e.g., g (global), gi (global+case insensitive), gms (global+multiline+dot all)"
                        className="font-mono"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Common flags: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">g</code> (global),
                        <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">i</code> (case insensitive),
                        <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">m</code> (multiline),
                        <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">s</code> (dot matches newline).
                        Combine flags: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">gi</code>,
                        <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">gms</code>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          {t.extensions.cancel}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? t.extensions.saving : t.extensions.saveExtension}
        </Button>
      </div>
    </div>
  );
}