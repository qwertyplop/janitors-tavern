'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ChatCompletionPresetEditor } from '@/components/presets';
import {
  getChatCompletionPresets,
  addChatCompletionPreset,
  updateChatCompletionPreset,
  deleteChatCompletionPreset,
  importSTPreset,
  createDefaultChatCompletionPreset,
  updateSettings,
} from '@/lib/storage';
import { ChatCompletionPreset, STChatCompletionPreset } from '@/types';
import { readJsonFile, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/I18nProvider';

export default function PresetsPage() {
  const [presets, setPresets] = useState<ChatCompletionPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ChatCompletionPreset | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const loaded = getChatCompletionPresets();
    setPresets(loaded);
    if (loaded.length > 0 && !selectedId) {
      setSelectedId(loaded[0].id);
    }
  }, []);

  const selectedPreset = presets.find(p => p.id === selectedId);

  // Set selected preset as default
  const selectAndSetDefault = (id: string) => {
    setSelectedId(id);
    // Also update settings to make this the default chat completion preset
    updateSettings({ defaultChatCompletionPresetId: id });
  };

  const handleCreate = () => {
    const newPreset = createDefaultChatCompletionPreset();
    const now = new Date().toISOString();
    setEditingPreset({
      ...newPreset,
      id: '',
      createdAt: now,
      updatedAt: now,
    } as ChatCompletionPreset);
    setIsEditing(true);
  };

  const handleEdit = (preset: ChatCompletionPreset) => {
    setEditingPreset({ ...preset });
    setIsEditing(true);
  };

  const handleSave = (preset: ChatCompletionPreset) => {
    if (!preset.id) {
      const added = addChatCompletionPreset(preset);
      selectAndSetDefault(added.id);
    } else {
      updateChatCompletionPreset(preset.id, preset);
    }
    setPresets(getChatCompletionPresets());
    setIsEditing(false);
    setEditingPreset(null);
  };

  const handleDelete = (id: string) => {
    deleteChatCompletionPreset(id);
    const updated = getChatCompletionPresets();
    setPresets(updated);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    setDeleteConfirmId(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      for (const file of Array.from(files)) {
        const data = await readJsonFile<STChatCompletionPreset>(file);
        if (data && typeof data === 'object' && 'prompts' in data) {
          const imported = importSTPreset(data, file.name);
          const added = addChatCompletionPreset(imported);
          selectAndSetDefault(added.id);
        }
      }
      setPresets(getChatCompletionPresets());
    } catch (error) {
      console.error('Import failed:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDuplicate = (preset: ChatCompletionPreset) => {
    const duplicated = {
      ...preset,
      name: `${preset.name} (Copy)`,
    };
    const added = addChatCompletionPreset(duplicated);
    setPresets(getChatCompletionPresets());
    selectAndSetDefault(added.id);
  };

  // If editing, show the editor full-screen
  if (isEditing && editingPreset) {
    return (
      <div className="space-y-6">
        <ChatCompletionPresetEditor
          preset={editingPreset}
          onChange={setEditingPreset}
          onSave={handleSave}
          onCancel={() => {
            setIsEditing(false);
            setEditingPreset(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t.presets.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t.presets.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            {t.presets.importSTPreset}
          </Button>
          <Button onClick={handleCreate}>{t.presets.newPreset}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Preset List */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            {t.presets.savedPresets}
          </h2>
          {presets.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                {t.presets.noPresetsYet}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <Card
                  key={preset.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors',
                    selectedId === preset.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                  onClick={() => selectAndSetDefault(preset.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{preset.name}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {preset.promptBlocks.length} blocks · T: {preset.sampler.temperature}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(preset);
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
                          setDeleteConfirmId(preset.id);
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

        {/* Right Panel - Preset Details */}
        <div className="lg:col-span-2">
          {selectedPreset ? (
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {selectedPreset.name}
                      {selectedPreset.sourceFileName && (
                        <Badge variant="outline">{t.presets.imported}</Badge>
                      )}
                    </CardTitle>
                    {selectedPreset.description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {selectedPreset.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Sampler Settings Overview */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                    {t.presets.samplerSettings}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-xs">{t.presets.temperature}</span>
                      <span className="font-medium">{selectedPreset.sampler.temperature}</span>
                    </div>
                    <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-xs">{t.presets.topP}</span>
                      <span className="font-medium">{selectedPreset.sampler.top_p}</span>
                    </div>
                    <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-xs">{t.presets.maxTokens}</span>
                      <span className="font-medium">{selectedPreset.sampler.openai_max_tokens}</span>
                    </div>
                    <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 block text-xs">{t.presets.maxContext}</span>
                      <span className="font-medium">{selectedPreset.sampler.openai_max_context}</span>
                    </div>
                  </div>
                </div>

                {/* Prompt Blocks Overview */}
                <div className="space-y-3">
                  {(() => {
                    // Get order and enabled status from promptOrder (character_id 100001 is the main order)
                    const mainOrder = selectedPreset.promptOrder?.find(o => o.character_id === 100001);
                    const blockMap = new Map(selectedPreset.promptBlocks.map(b => [b.identifier, b]));

                    // Build sorted list of enabled blocks according to promptOrder
                    const sortedEnabledBlocks: typeof selectedPreset.promptBlocks = [];
                    if (mainOrder) {
                      for (const item of mainOrder.order) {
                        if (item.enabled) {
                          const block = blockMap.get(item.identifier);
                          if (block) {
                            sortedEnabledBlocks.push(block);
                          }
                        }
                      }
                    }

                    return (
                      <>
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                          {t.presets.promptBlocks} ({sortedEnabledBlocks.length} {t.presets.enabledOf} {selectedPreset.promptBlocks.length})
                        </h3>
                        {/* Header */}
                        <div className="grid grid-cols-[80px_1fr_80px] gap-3 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                          <span>{t.presets.role}</span>
                          <span>{t.common.name}</span>
                          <span className="text-right">{t.presets.type}</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-2">
                          {sortedEnabledBlocks.map((block, idx) => (
                            <div
                              key={block.identifier || idx}
                              className={cn(
                                "grid grid-cols-[80px_1fr_80px] gap-3 items-center text-sm px-3 py-3 rounded-md border",
                                block.marker
                                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                              )}
                            >
                              <Badge variant="outline" className="text-xs w-fit">
                                {block.role.charAt(0).toUpperCase() + block.role.slice(1)}
                              </Badge>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate font-medium">{block.name || block.identifier}</span>
                                {block.marker && (
                                  <span className="text-amber-600 dark:text-amber-400 flex-shrink-0" title="Marker - Dynamic content placeholder">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <span className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                                {block.marker ? t.presets.marker : (block.injection_position === 0 ? t.presets.relative : t.presets.inChat)}
                              </span>
                            </div>
                          ))}
                          {sortedEnabledBlocks.length === 0 && (
                            <p className="text-xs text-zinc-500 text-center py-4">
                              {t.presets.noEnabledBlocks}
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Tags */}
                {selectedPreset.tags.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
                      {t.common.tags}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPreset.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                  {t.presets.lastUpdated} {formatDate(selectedPreset.updatedAt)}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t flex gap-2">
                  <Button onClick={() => handleEdit(selectedPreset)}>
                    {t.presets.editPreset}
                  </Button>
                  <Button variant="outline" onClick={() => handleDuplicate(selectedPreset)}>
                    {t.common.duplicate}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 flex items-center justify-center">
              <div className="text-center">
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                  {presets.length === 0
                    ? t.presets.createOrImport
                    : t.presets.selectPresetFromList}
                </p>
                {presets.length === 0 && (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      {t.presets.importPreset}
                    </Button>
                    <Button onClick={handleCreate}>{t.presets.newPreset}</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.presets.deletePreset}</DialogTitle>
            <DialogDescription>
              {t.presets.deletePresetConfirm}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
