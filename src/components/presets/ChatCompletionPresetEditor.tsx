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

const TABS: Tab[] = [
  { id: 'prompts', label: 'Prompt Blocks' },
  { id: 'sampler', label: 'Sampler Settings' },
  { id: 'advanced', label: 'Advanced' },
];

const NAMES_BEHAVIOR_OPTIONS = [
  { value: 0, label: 'None', description: 'No special handling for character names' },
  { value: 1, label: 'Prefix messages', description: 'Add character name prefix to messages' },
  { value: 2, label: 'Include in system', description: 'Include names in system prompt' },
  { value: 3, label: 'Both', description: 'Prefix and system prompt' },
];

const REASONING_EFFORT_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Let the model decide' },
  { value: 'min', label: 'Minimum', description: 'Minimal reasoning (1024 tokens)' },
  { value: 'low', label: 'Low', description: '15% of max response' },
  { value: 'medium', label: 'Medium', description: '25% of max response' },
  { value: 'high', label: 'High', description: '50% of max response' },
  { value: 'max', label: 'Maximum', description: '95% of max response' },
];


export function ChatCompletionPresetEditor({
  preset,
  onChange,
  onSave,
  onCancel,
}: ChatCompletionPresetEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('prompts');

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
              <Label htmlFor="name">Preset Name</Label>
              <Input
                id="name"
                value={preset.name}
                onChange={(e) => onChange({ ...preset, name: e.target.value })}
                placeholder="Preset name"
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={preset.tags.join(', ')}
                onChange={(e) =>
                  onChange({
                    ...preset,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="tag1, tag2, ..."
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={preset.description || ''}
              onChange={(e) => onChange({ ...preset, description: e.target.value })}
              placeholder="Optional description..."
              className="h-20"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(cleanupPresetForSave(preset))}>Save Preset</Button>
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
              <h3 className="text-lg font-semibold mb-4">Provider Settings</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Settings specific to different API providers
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
                    <span className="text-sm font-medium">Use Claude System Prompt</span>
                    <p className="text-xs text-zinc-500">Merge system messages into a separate system instruction field (Claude)</p>
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
                    <span className="text-sm font-medium">Use MakerSuite System Prompt</span>
                    <p className="text-xs text-zinc-500">Merge system messages into a separate system instruction field (Gemini)</p>
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
                    <span className="text-sm font-medium">Squash System Messages</span>
                    <p className="text-xs text-zinc-500">Combine consecutive System messages into a single message (deprecated)</p>
                  </div>
                </label>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Note: Streaming is controlled by the JanitorAI request, not preset settings.
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Reasoning Settings</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Settings for models that support reasoning/thinking modes
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
                  <Select
                    id="reasoningEffort"
                    value={preset.advancedSettings.reasoningEffort}
                    onChange={(e) => handleAdvancedSettingsChange('reasoningEffort', e.target.value)}
                  >
                    {REASONING_EFFORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-zinc-500 mt-1">
                    {REASONING_EFFORT_OPTIONS.find((o) => o.value === preset.advancedSettings.reasoningEffort)?.description}
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
                      <span className="text-sm font-medium">Show Thoughts</span>
                      <p className="text-xs text-zinc-500">Display model reasoning in responses</p>
                    </div>
                  </label>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Media Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.mediaSettings.imageInlining}
                    onChange={(e) =>
                      onChange({
                        ...preset,
                        mediaSettings: { ...preset.mediaSettings, imageInlining: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Send Inline Images</span>
                    <p className="text-xs text-zinc-500">Enable multimodal image processing</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.mediaSettings.videoInlining}
                    onChange={(e) =>
                      onChange({
                        ...preset,
                        mediaSettings: { ...preset.mediaSettings, videoInlining: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Send Inline Videos</span>
                    <p className="text-xs text-zinc-500">Enable multimodal video processing</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.requestImages}
                    onChange={(e) => handleAdvancedSettingsChange('requestImages', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Request Inline Images</span>
                    <p className="text-xs text-zinc-500">Allow model to return image attachments</p>
                  </div>
                </label>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Advanced Features</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={preset.advancedSettings.functionCalling}
                    onChange={(e) => handleAdvancedSettingsChange('functionCalling', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Enable Function Calling</span>
                    <p className="text-xs text-zinc-500">Allow model to call functions/tools</p>
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
                    <span className="text-sm font-medium">Enable Web Search</span>
                    <p className="text-xs text-zinc-500">Enrich prompts with search results</p>
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
                    <span className="text-sm font-medium">Wrap in Quotes</span>
                    <p className="text-xs text-zinc-500">Wrap user messages in hidden quotation marks (deprecated)</p>
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
                    <span className="text-sm font-medium">Unlock Max Context</span>
                    <p className="text-xs text-zinc-500">Allow higher context limits</p>
                  </div>
                </label>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Start Reply With</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Prepend text to the beginning of every AI response. Useful for forcing a specific format or style.
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
                  <span className="text-sm font-medium">Enable Start Reply With</span>
                </label>
                <div className={preset.advancedSettings.startReplyWith?.enabled ? '' : 'opacity-50'}>
                  <Label htmlFor="startReplyContent">Content to prepend</Label>
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
                    placeholder="Text to prepend to AI responses..."
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
