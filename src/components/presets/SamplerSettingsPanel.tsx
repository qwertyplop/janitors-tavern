'use client';

import { STSamplerSettings, SamplerSettingKey } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DEFAULT_SAMPLER_SETTINGS } from '@/lib/storage';
import { useI18n } from '@/components/providers/I18nProvider';

interface SamplerSettingsPanelProps {
  settings: STSamplerSettings;
  onChange: (settings: STSamplerSettings) => void;
  enabledSettings?: Partial<Record<SamplerSettingKey, boolean>>;
  onEnabledChange?: (enabled: Partial<Record<SamplerSettingKey, boolean>>) => void;
}


export function SamplerSettingsPanel({
  settings,
  onChange,
  enabledSettings,
  onEnabledChange,
}: SamplerSettingsPanelProps) {
  const { t } = useI18n();
  const handleChange = <K extends keyof STSamplerSettings>(
    key: K,
    value: STSamplerSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  // Helper to check if a setting is enabled following hierarchy:
  // 1. User setting (enabledSettings[key]) if defined
  // 2. If value differs from default → enabled (except max tokens which is always enabled by default)
  // 3. Otherwise disabled
  const isEnabled = (key: SamplerSettingKey): boolean => {
    // User setting takes precedence
    if (enabledSettings && enabledSettings[key] !== undefined) {
      return enabledSettings[key] === true;
    }
    
    // Max tokens is always enabled by default unless explicitly disabled
    if (key === 'openai_max_tokens') {
      return true;
    }
    
    // Compare value with default
    const value = settings[key];
    const defaultValue = DEFAULT_SAMPLER_SETTINGS[key];
    // Use loose equality for numbers (including NaN handling)
    return value !== defaultValue;
  };

  // Helper to toggle a setting's enabled state
  const toggleEnabled = (key: SamplerSettingKey, enabled: boolean) => {
    if (onEnabledChange) {
      onEnabledChange({ ...enabledSettings, [key]: enabled });
    }
  };

  // SliderInput component inside the main component to access t
  const SliderInput = ({
    label,
    description,
    value,
    onChange,
    min,
    max,
    step,
    settingKey,
    enabled,
    onEnabledChange,
  }: {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    settingKey: SamplerSettingKey;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
  }) => {
    return (
      <div className={`space-y-2 ${!enabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              title={enabled ? t.sampler.disableSettingTitle : t.sampler.enableSettingTitle}
            />
            <Label className="text-sm font-medium">{label}</Label>
          </div>
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={min}
            max={max}
            step={step}
            className="w-24 text-right"
            disabled={!enabled}
          />
        </div>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          disabled={!enabled}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t.sampler.excludeSettingsHint}
      </p>

      {/* Core Sampling Parameters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t.sampler.coreSamplingParameters}</h3>
        <div className="space-y-6">
          <SliderInput
            label={t.sampler.temperature}
            description={t.sampler.temperatureDescription}
            value={settings.temperature}
            onChange={(v) => handleChange('temperature', v)}
            min={0}
            max={2}
            step={0.01}
            settingKey="temperature"
            enabled={isEnabled('temperature')}
            onEnabledChange={(e) => toggleEnabled('temperature', e)}
          />

          <SliderInput
            label={t.sampler.topP}
            description={t.sampler.topPDescription}
            value={settings.top_p}
            onChange={(v) => handleChange('top_p', v)}
            min={0}
            max={1}
            step={0.01}
            settingKey="top_p"
            enabled={isEnabled('top_p')}
            onEnabledChange={(e) => toggleEnabled('top_p', e)}
          />

          <SliderInput
            label={t.sampler.topK}
            description={t.sampler.topKDescription}
            value={settings.top_k}
            onChange={(v) => handleChange('top_k', v)}
            min={0}
            max={200}
            step={1}
            settingKey="top_k"
            enabled={isEnabled('top_k')}
            onEnabledChange={(e) => toggleEnabled('top_k', e)}
          />

          <SliderInput
            label={t.sampler.minP}
            description={t.sampler.minPDescription}
            value={settings.min_p}
            onChange={(v) => handleChange('min_p', v)}
            min={0}
            max={1}
            step={0.01}
            settingKey="min_p"
            enabled={isEnabled('min_p')}
            onEnabledChange={(e) => toggleEnabled('min_p', e)}
          />
        </div>
      </Card>

      {/* Penalty Parameters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t.sampler.penaltyParameters}</h3>
        <div className="space-y-6">
          <SliderInput
            label={t.sampler.frequencyPenalty}
            description={t.sampler.frequencyPenaltyDescription}
            value={settings.frequency_penalty}
            onChange={(v) => handleChange('frequency_penalty', v)}
            min={-2}
            max={2}
            step={0.01}
            settingKey="frequency_penalty"
            enabled={isEnabled('frequency_penalty')}
            onEnabledChange={(e) => toggleEnabled('frequency_penalty', e)}
          />

          <SliderInput
            label={t.sampler.presencePenalty}
            description={t.sampler.presencePenaltyDescription}
            value={settings.presence_penalty}
            onChange={(v) => handleChange('presence_penalty', v)}
            min={-2}
            max={2}
            step={0.01}
            settingKey="presence_penalty"
            enabled={isEnabled('presence_penalty')}
            onEnabledChange={(e) => toggleEnabled('presence_penalty', e)}
          />

          <SliderInput
            label={t.sampler.repetitionPenalty}
            description={t.sampler.repetitionPenaltyDescription}
            value={settings.repetition_penalty}
            onChange={(v) => handleChange('repetition_penalty', v)}
            min={0.1}
            max={2}
            step={0.01}
            settingKey="repetition_penalty"
            enabled={isEnabled('repetition_penalty')}
            onEnabledChange={(e) => toggleEnabled('repetition_penalty', e)}
          />
        </div>
      </Card>

      {/* Context and Token Limits */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t.sampler.contextTokenLimits}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max_context">{t.sampler.maxContext}</Label>
            <Input
              id="max_context"
              type="number"
              value={isNaN(settings.openai_max_context) ? '' : settings.openai_max_context}
              onChange={(e) => {
                const val = e.target.value;
                const parsed = parseInt(val);
                handleChange('openai_max_context', isNaN(parsed) ? NaN : parsed);
              }}
              min={1}
            />
            <p className="text-xs text-gray-500">{t.sampler.maxContextWindowHint}</p>
          </div>

          <div className={`space-y-2 ${!isEnabled('openai_max_tokens') ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isEnabled('openai_max_tokens')}
                onChange={(e) => toggleEnabled('openai_max_tokens', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="max_tokens">{t.sampler.maxResponseTokens}</Label>
            </div>
            <Input
              id="max_tokens"
              type="number"
              value={isNaN(settings.openai_max_tokens) ? '' : settings.openai_max_tokens}
              onChange={(e) => {
                const val = e.target.value;
                const parsed = parseInt(val);
                handleChange('openai_max_tokens', isNaN(parsed) ? NaN : parsed);
              }}
              min={1}
              disabled={!isEnabled('openai_max_tokens')}
            />
            <p className="text-xs text-gray-500">{t.sampler.maxTokensResponseHint}</p>
          </div>
        </div>
      </Card>

      {/* Generation Settings */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t.sampler.generationSettings}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={`space-y-2 ${!isEnabled('seed') ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isEnabled('seed')}
                onChange={(e) => toggleEnabled('seed', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="seed">{t.sampler.seed}</Label>
            </div>
            <Input
              id="seed"
              type="number"
              value={isNaN(settings.seed) ? '' : settings.seed}
              onChange={(e) => {
                const val = e.target.value;
                const parsed = parseInt(val);
                handleChange('seed', isNaN(parsed) ? NaN : parsed);
              }}
              disabled={!isEnabled('seed')}
            />
            <p className="text-xs text-gray-500">{t.sampler.randomSeedHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n">{t.sampler.numberCompletions}</Label>
            <Input
              id="n"
              type="number"
              value={isNaN(settings.n) ? '' : settings.n}
              onChange={(e) => {
                const val = e.target.value;
                const parsed = parseInt(val);
                handleChange('n', isNaN(parsed) ? NaN : parsed);
              }}
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500">{t.sampler.numberCompletionsHint}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
