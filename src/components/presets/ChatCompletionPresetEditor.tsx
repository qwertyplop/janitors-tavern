'use client';

import { useState } from 'react';
import { ChatCompletionPreset, STPromptBlock, STPromptOrder, STSamplerSettings, SamplerSettingKey } from '@/types';
import { PromptBlockList } from './PromptBlockList';
import { SamplerSettingsPanel } from './SamplerSettingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/I18nProvider';

interface ChatCompletionPresetEditorProps {
  preset: ChatCompletionPreset;
  onChange: (preset: ChatCompletionPreset) => void;
  onSave: (preset: ChatCompletionPreset) => void;
  onCancel: () => void;
}

type TabId = 'prompts' | 'sampler' | 'advanced';

interface Tab {
  id: TabId;
  label: string;
}


export function ChatCompletionPresetEditor({
  preset,
  onChange,
  onSave,
  onCancel,
}: ChatCompletionPresetEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const { t } = useI18n();

  // Create tabs using translation keys
  const TABS: Tab[] = [
    { id: 'prompts', label: t.presets.presetEditor.tabs.prompts },
    { id: 'sampler', label: t.presets.presetEditor.tabs.sampler },
    { id: 'advanced', label: t.presets.presetEditor.tabs.advanced },
  ];

  const handleBlocksChange = (
    promptBlocks: STPromptBlock[],
    promptOrder: STPromptOrder[]
  ) => {
    onChange({ ...preset, promptBlocks, promptOrder });
  };

  const handleSamplerChange = (sampler: STSamplerSettings) => {
    onChange({ ...preset, sampler });
  };

  const handleSamplerEnabledChange = (enabled: Partial<Record<SamplerSettingKey, boolean>>) => {
    onChange({ ...preset, samplerEnabled: enabled });
  };


  const handleFormatStringsChange = (
    key: keyof ChatCompletionPreset['formatStrings'],
    value: string
  ) => {
    onChange({
      ...preset,
      formatStrings: { ...preset.formatStrings, [key]: value },
    });
  };

  const handleProviderSettingsChange = (
    key: keyof ChatCompletionPreset['providerSettings'],
    value: boolean
  ) => {
    onChange({
      ...preset,
      providerSettings: { ...preset.providerSettings, [key]: value },
    });
  };

  const handleAdvancedSettingsChange = <K extends keyof ChatCompletionPreset['advancedSettings']>(
    key: K,
    value: ChatCompletionPreset['advancedSettings'][K]
  ) => {
    onChange({
      ...preset,
      advancedSettings: { ...preset.advancedSettings, [key]: value },
    });
  };

  // Clean up NaN values in sampler settings before saving
  const cleanupPresetForSave = (presetToClean: ChatCompletionPreset): ChatCompletionPreset => {
    const cleanedSampler = { ...presetToClean.sampler };

    // Replace NaN with defaults
    if (isNaN(cleanedSampler.openai_max_context)) {
      cleanedSampler.openai_max_context = 4096;
    }
    if (isNaN(cleanedSampler.openai_max_tokens)) {
      cleanedSampler.openai_max_tokens = 2048;
    }
    if (isNaN(cleanedSampler.seed)) {
      cleanedSampler.seed = -1;
    }
    if (isNaN(cleanedSampler.n)) {
      cleanedSampler.n = 1;
    }

    return {
      ...presetToClean,
      sampler: cleanedSampler,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">{t.presets.presetEditor.labels.presetName}</Label>
              <Input
                id="name"
                value={preset.name}
                onChange={(e) => onChange({ ...preset, name: e.target.value })}
                placeholder={t.presets.presetEditor.placeholders.presetName}
              />
            </div>
            <div>
              <Label htmlFor="tags">{t.presets.presetEditor.labels.tags}</Label>
              <Input
                id="tags"
                value={preset.tags.join(', ')}
                onChange={(e) =>
                  onChange({
                    ...preset,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder={t.presets.presetEditor.placeholders.tags}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">{t.presets.presetEditor.labels.description}</Label>
            <Textarea
              id="description"
              value={preset.description || ''}
              onChange={(e) => onChange({ ...preset, description: e.target.value })}
              placeholder={t.presets.presetEditor.placeholders.description}
              className="h-20"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="outline" onClick={onCancel}>
          {t.presets.presetEditor.buttons.cancel}
        </Button>
        <Button onClick={() => onSave(cleanupPresetForSave(preset))}>
          {t.presets.presetEditor.buttons.savePreset}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 px-1 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'prompts' && (
          <PromptBlockList
            blocks={preset.promptBlocks}
            promptOrder={preset.promptOrder}
            onChange={handleBlocksChange}
          />
        )}

        {activeTab === 'sampler' && (
          <SamplerSettingsPanel
            settings={preset.sampler}
            onChange={handleSamplerChange}
            enabledSettings={preset.samplerEnabled}
            onEnabledChange={handleSamplerEnabledChange}
          />
        )}



        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">{t.presets.presetEditor.sections.providerSettings}</h3>
              <p className="text-sm text-zinc-500 mb-4">
                {t.presets.presetEditor.sections.providerSettingsDescription}
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.providerSettings.claudeUseSysprompt}
                    onChange={(e) => handleProviderSettingsChange('claudeUseSysprompt', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.claudeUseSysprompt}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.claudeUseSyspromptDesc}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.providerSettings.makersuiteUseSysprompt}
                    onChange={(e) => handleProviderSettingsChange('makersuiteUseSysprompt', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.makersuiteUseSysprompt}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.makersuiteUseSyspromptDesc}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.providerSettings.squashSystemMessages}
                    onChange={(e) => handleProviderSettingsChange('squashSystemMessages', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.squashSystemMessages}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.squashSystemMessagesDesc}</p>
                  </div>
                </label>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {t.presets.presetEditor.note}
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">{t.presets.presetEditor.sections.reasoningSettings}</h3>
              <p className="text-sm text-zinc-500 mb-4">
                {t.presets.presetEditor.sections.reasoningSettingsDescription}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
                  <Select
                    id="reasoningEffort"
                    value={preset.advancedSettings.reasoningEffort}
                    onChange={(e) => handleAdvancedSettingsChange('reasoningEffort', e.target.value)}
                  >
                    {t.presets.presetEditor.reasoningEffortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t.presets.presetEditor.reasoningEffortOptions.find((o) => o.value === preset.advancedSettings.reasoningEffort)?.description}
                  </p>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preset.advancedSettings.showThoughts}
                      onChange={(e) => handleAdvancedSettingsChange('showThoughts', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.showThoughts}</span>
                      <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.showThoughtsDesc}</p>
                    </div>
                  </label>
                </div>
              </div>
            </Card>


            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">{t.presets.presetEditor.sections.advancedFeatures}</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.functionCalling}
                    onChange={(e) => handleAdvancedSettingsChange('functionCalling', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.enableFunctionCalling}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.enableFunctionCallingDesc}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.enableWebSearch}
                    onChange={(e) => handleAdvancedSettingsChange('enableWebSearch', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.enableWebSearch}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.enableWebSearchDesc}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.wrapInQuotes}
                    onChange={(e) => handleAdvancedSettingsChange('wrapInQuotes', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.wrapInQuotes}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.wrapInQuotesDesc}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.maxContextUnlocked}
                    onChange={(e) => handleAdvancedSettingsChange('maxContextUnlocked', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.maxContextUnlocked}</span>
                    <p className="text-xs text-zinc-500">{t.presets.presetEditor.checkboxes.maxContextUnlockedDesc}</p>
                  </div>
                </label>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">{t.presets.presetEditor.sections.startReplyWith}</h3>
              <p className="text-sm text-zinc-500 mb-4">
                {t.presets.presetEditor.sections.startReplyWithDescription}
              </p>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.startReplyWith?.enabled ?? false}
                    onChange={(e) => handleAdvancedSettingsChange('startReplyWith', {
                      ...preset.advancedSettings.startReplyWith,
                      enabled: e.target.checked,
                    })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">{t.presets.presetEditor.checkboxes.enableStartReplyWith}</span>
                </label>
                <div className={preset.advancedSettings.startReplyWith?.enabled ? '' : 'opacity-50'}>
                  <Label htmlFor="startReplyContent">{t.presets.presetEditor.checkboxes.startReplyContent}</Label>
                  <Textarea
                    id="startReplyContent"
                    value={preset.advancedSettings.startReplyWith?.content ?? ''}
                    onChange={(e) => handleAdvancedSettingsChange('startReplyWith', {
                      ...preset.advancedSettings.startReplyWith,
                      enabled: preset.advancedSettings.startReplyWith?.enabled ?? false,
                      content: e.target.value,
                    })}
                    disabled={!preset.advancedSettings.startReplyWith?.enabled}
                    className="h-20 font-mono text-sm"
                    placeholder={t.presets.presetEditor.checkboxes.startReplyContentPlaceholder}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
