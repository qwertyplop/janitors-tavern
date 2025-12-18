'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { downloadJson, readJsonFile } from '@/lib/utils';
import {
  getRegexScripts,
  addRegexScript,
  updateRegexScript,
  deleteRegexScript,
  saveRegexScripts,
  generateId,
} from '@/lib/storage';
import { RegexScript } from '@/types';
import { applyRegexScript, applyRegexScripts } from '@/lib/regex-processor';
import { createDefaultMacroContext } from '@/lib/macros';
import { useI18n } from '@/components/providers/I18nProvider';

export default function RegexScriptManager() {
  const [scripts, setScripts] = useState<RegexScript[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  
  const placementLabels: Record<number, string> = {
    1: 'Before sending to Model',
    2: 'After receiving from Model',
  };
  
  function formatPlacement(arr: number[]): string {
    if (!arr || arr.length === 0) return 'None';
    return arr.map(v => placementLabels[v] ?? 'Unknown').join(', ');
  }

  // Form state for create/edit dialog
  const [formName, setFormName] = useState('');
  const [formFindRegex, setFormFindRegex] = useState('');
  const [formReplaceString, setFormReplaceString] = useState('');
  const [formTrimStrings, setFormTrimStrings] = useState<string[]>([]);
  const [formPlacement, setFormPlacement] = useState<number[]>([2]);
  const [showTestMode, setShowTestMode] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [formMarkdownOnly, setFormMarkdownOnly] = useState(false);
  const [formSubstituteRegex, setFormSubstituteRegex] = useState<0 | 1 | 2>(0);
  const [formMinDepth, setFormMinDepth] = useState<number | null>(null);
  const [formMaxDepth, setFormMaxDepth] = useState<number | null>(null);

  useEffect(() => {
    const stored = getRegexScripts();
    setScripts(stored);
    if (stored.length > 0) {
      setSelectedId(stored[0].id);
    }
  }, []);

  // Real‑time test mode processing
  useEffect(() => {
    if (showTestMode) {
      const tempScript = {
        scriptName: formName,
        findRegex: formFindRegex,
        replaceString: formReplaceString,
        trimStrings: formTrimStrings,
        placement: formPlacement,
        substituteRegex: formSubstituteRegex,
        minDepth: formMinDepth,
        maxDepth: formMaxDepth,
        disabled: false,
        markdownOnly: formMarkdownOnly,
        runOnEdit: false,
        id: '',
        createdAt: '',
        updatedAt: '',
      } as any; // cast to satisfy applyRegexScripts

      // Determine which placement to test against; default to "After receiving from Model" (2)
      const placementToTest = formPlacement.length > 0 ? formPlacement[0] : 2;

      const output = applyRegexScripts(
        testInput,
        [tempScript],
        createDefaultMacroContext(),
        placementToTest
      );
      setTestOutput(output);
    } else {
      setTestOutput('');
    }
  }, [
    showTestMode,
    testInput,
    formName,
    formFindRegex,
    formReplaceString,
    formTrimStrings,
    formPlacement,
    formMarkdownOnly,
    formSubstituteRegex,
    formMinDepth,
    formMaxDepth,
  ]);

  const selectedScript = scripts.find(s => s.id === selectedId);

  const handleCreate = () => {
    setEditingId(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (script: RegexScript) => {
    setEditingId(script.id);
    setFormName(script.scriptName);
    setFormFindRegex(script.findRegex);
    setFormReplaceString(script.replaceString);
    setFormTrimStrings([...script.trimStrings]);
    setFormPlacement([...script.placement]);
    setFormMarkdownOnly(script.markdownOnly);
    setFormSubstituteRegex(script.substituteRegex);
    setFormMinDepth(script.minDepth);
    setFormMaxDepth(script.maxDepth);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormFindRegex('');
    setFormReplaceString('');
    setFormTrimStrings([]);
    setFormPlacement([2]);
    setFormMarkdownOnly(false);
    setFormSubstituteRegex(0);
    setFormMinDepth(null);
    setFormMaxDepth(null);
  };

  const handleSave = () => {
    if (!formName || !formFindRegex) return;

    const scriptData: Omit<RegexScript, 'id' | 'createdAt' | 'updatedAt'> = {
        scriptName: formName,
        findRegex: formFindRegex,
        replaceString: formReplaceString,
        trimStrings: formTrimStrings,
        placement: formPlacement,
        // New scripts start enabled; when editing we keep the existing disabled flag
        disabled: editingId
          ? (scripts.find(s => s.id === editingId)?.disabled ?? false)
          : false,
        markdownOnly: formMarkdownOnly,
        substituteRegex: formSubstituteRegex,
        minDepth: formMinDepth,
        maxDepth: formMaxDepth,
        runOnEdit: false,
    };

    if (editingId) {
      updateRegexScript(editingId, scriptData);
    } else {
      addRegexScript(scriptData);
    }

    setScripts(getRegexScripts());
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteRegexScript(id);
    const updated = getRegexScripts();
    setScripts(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    setDeleteConfirmId(null);
    // Reset test mode when dialog closes
    if (!isDialogOpen) {
      setShowTestMode(false);
      setTestInput('');
      setTestOutput('');
    }
  };

  const handleExport = (script: RegexScript) => {
    downloadJson(script, `regex-script-${script.scriptName.replace(/\s+/g, '-').toLowerCase()}.json`);
  };

  const handleExportAll = () => {
    downloadJson(scripts, 'regex-scripts-export.json');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readJsonFile<RegexScript | RegexScript[]>(file);
      const scriptsToImport = Array.isArray(data) ? data : [data];
      const now = new Date().toISOString();

      const newScripts = scriptsToImport.map((s) => ({
        ...s,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      })) as RegexScript[];

      const existingScripts = getRegexScripts();
      saveRegexScripts([...existingScripts, ...newScripts]);
      setScripts(getRegexScripts());
    } catch (error) {
      console.error('Import failed:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleEnabled = (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (script) {
      updateRegexScript(id, { disabled: !script.disabled });
      setScripts(getRegexScripts());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Regex Scripts</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage regex scripts for pre/post-processing of messages.
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
            Import
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={scripts.length === 0}>
            Export All
          </Button>
          <Button onClick={handleCreate}>New Script</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Script List */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Saved Scripts ({scripts.length})
          </h3>
          {scripts.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                No regex scripts yet. Create your first one!
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {scripts.map((script) => (
                <Card
                  key={script.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors',
                    selectedId === script.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                  onClick={() => setSelectedId(script.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{script.scriptName}</h4>
                        {script.disabled && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {script.findRegex.substring(0, 50)}...
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEnabled(script.id);
                        }}
                      >
                        {script.disabled ? '🔴' : '🟢'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(script);
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
                          setDeleteConfirmId(script.id);
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

        {/* Right Panel - Script Details */}
        <div className="lg:col-span-2">
          {selectedScript ? (
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">{selectedScript.scriptName}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {selectedScript.disabled && (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                  {selectedScript.markdownOnly && (
                    <Badge variant="outline">Markdown Only</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Find Regex</h4>
                  <pre className="text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded overflow-x-auto">
                    {selectedScript.findRegex}
                  </pre>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Replace With</h4>
                  <pre className="text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded overflow-x-auto">
                    {selectedScript.replaceString}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Affects</h4>
                    <p className="text-sm">{formatPlacement(selectedScript.placement)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Trim Strings</h4>
                    <p className="text-sm">{selectedScript.trimStrings.length > 0 ? selectedScript.trimStrings.join(', ') : 'None'}</p>
                  </div>
                </div>
                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(selectedScript)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(selectedScript)}
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
                  {scripts.length === 0
                    ? 'Create your first regex script to get started'
                    : 'Select a script from the list to view details'}
                </p>
                {scripts.length === 0 && (
                  <Button onClick={handleCreate}>New Script</Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Regex Script' : 'New Regex Script'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500 px-6 pt-2">
            Regex scripts allow you to find and replace text in messages using regular expressions.
            They can be applied to user input, AI output, or both, with optional depth and markdown filtering.
          </p>
          <p className="text-xs text-zinc-500 px-6">
            Note: the “Run on Edit” option has been removed; scripts no longer execute automatically when editing messages.
          </p>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Script Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Regex Script"
              />
              <p className="text-xs text-zinc-500">
                A descriptive name for this script, used in the script list.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="findRegex">Find Regex</Label>
              <Input
                id="findRegex"
                value={formFindRegex}
                onChange={(e) => setFormFindRegex(e.target.value)}
                placeholder="/pattern/flags"
              />
              <p className="text-xs text-zinc-500">
                Regular expression pattern to search for. Use /pattern/flags format (e.g., /hello/gi) or plain text.
                If using flags, ensure they are valid JavaScript regex flags (g, i, m, s, u, y).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replaceString">Replace With</Label>
              <Input
                id="replaceString"
                value={formReplaceString}
                onChange={(e) => setFormReplaceString(e.target.value)}
                placeholder="Replacement text"
              />
              <p className="text-xs text-zinc-500">
                Text to replace matches with. Can include capture groups like $1, $2, etc.
                Use {'{{match}}'} to insert the trimmed matched text. Leave empty to delete matches.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trimStrings">Trim Strings (one per line)</Label>
              <textarea
                id="trimStrings"
                className="w-full min-h-[80px] border rounded-md p-2 text-sm"
                value={formTrimStrings.join('\n')}
                onChange={(e) => setFormTrimStrings(e.target.value.split('\n').filter(s => s.trim() !== ''))}
                placeholder="le\napp"
              />
              <p className="text-xs text-zinc-500">
                List of strings to trim from matches before replacement. One per line.
                For example, 'le' and 'app' will trim 'le' and 'app' from the matched text.
              </p>
              </div>
              
              {/* Test Mode Button */}
              <div className="space-y-2 px-6">
                <Button
                  variant="outline"
                  onClick={() => setShowTestMode(prev => !prev)}
                >
                  Test Mode
                </Button>
                <p className="text-xs text-zinc-500">
                  The Test Mode button appears between the Trim Strings field and the Affects checkboxes. Click “Test Mode” to preview the script’s effect on sample input; the Input textarea and read‑only Output area appear directly below the button when active.
                </p>
                {showTestMode && (
                  <div className="space-y-2">
                    <Label htmlFor="testInput">Input</Label>
                    <textarea
                      id="testInput"
                      className="w-full min-h-[80px] border rounded-md p-2 text-sm"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test string..."
                    />
                    <Label htmlFor="testOutput">Output</Label>
                    <pre
                      id="testOutput"
                      className="w-full min-h-[80px] border rounded-md p-2 text-sm bg-zinc-100 dark:bg-zinc-800 overflow-auto"
                    >
                      {testOutput}
                    </pre>
                  </div>
                )}
              </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="affects">Affects</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="affectsBefore"
                      checked={formPlacement.includes(1)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormPlacement((prev) => {
                          const set = new Set(prev);
                          if (checked) set.add(1);
                          else set.delete(1);
                          return Array.from(set).sort();
                        });
                      }}
                    />
                    <Label htmlFor="affectsBefore">Before sending to Model</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="affectsAfter"
                      checked={formPlacement.includes(2)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormPlacement((prev) => {
                          const set = new Set(prev);
                          if (checked) set.add(2);
                          else set.delete(2);
                          return Array.from(set).sort();
                        });
                      }}
                    />
                    <Label htmlFor="affectsAfter">After receiving from Model</Label>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  Where the script should be applied: 1 = user input, 2 = AI output.
                  Select one or both options. Default is 2 (AI output).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="substituteRegex">Substitute Macros</Label>
                <select
                  id="substituteRegex"
                  className="w-full border rounded-md p-2 text-sm"
                  value={formSubstituteRegex}
                  onChange={(e) => setFormSubstituteRegex(parseInt(e.target.value) as 0 | 1 | 2)}
                >
                  <option value={0}>Don't substitute</option>
                  <option value={1}>Raw</option>
                  <option value={2}>Escaped</option>
                </select>
                <p className="text-xs text-zinc-500">
                  Whether to substitute macros (e.g., {'{{char}}'}, {'{{user}}'}) in the find regex.
                  Raw = replace with macro values; Escaped = also escape regex special characters.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minDepth">Min Depth (optional)</Label>
                <Input
                  id="minDepth"
                  type="number"
                  value={formMinDepth ?? ''}
                  onChange={(e) => setFormMinDepth(e.target.value === '' ? null : parseInt(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-zinc-500">
                  Minimum message depth (0 = last message) where the script will apply.
                  Leave empty for no minimum.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDepth">Max Depth (optional)</Label>
                <Input
                  id="maxDepth"
                  type="number"
                  value={formMaxDepth ?? ''}
                  onChange={(e) => setFormMaxDepth(e.target.value === '' ? null : parseInt(e.target.value))}
                  placeholder="5"
                />
                <p className="text-xs text-zinc-500">
                  Maximum message depth (0 = last message) where the script will apply.
                  Leave empty for no maximum.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="markdownOnly"
                    checked={formMarkdownOnly}
                    onChange={(e) => setFormMarkdownOnly(e.target.checked)}
                  />
                  <Label htmlFor="markdownOnly">Markdown Only</Label>
                </div>
                <p className="text-xs text-zinc-500">
                  Only apply if the message contains markdown formatting.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName || !formFindRegex}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Regex Script</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete this script? This action cannot be undone.
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