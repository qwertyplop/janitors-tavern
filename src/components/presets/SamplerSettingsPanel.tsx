'use client';

import { STSamplerSettings } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface SamplerSettingsPanelProps {
  settings: STSamplerSettings;
  onChange: (settings: STSamplerSettings) => void;
}

interface SliderInputProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function SliderInput({ label, description, value, onChange, min, max, step }: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-24 text-right"
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
      />
    </div>
  );
}

export function SamplerSettingsPanel({ settings, onChange }: SamplerSettingsPanelProps) {
  const handleChange = <K extends keyof STSamplerSettings>(
    key: K,
    value: STSamplerSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Core Sampling Parameters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Core Sampling Parameters</h3>
        <div className="space-y-6">
          <SliderInput
            label="Temperature"
            description="Controls randomness. Higher values make output more random."
            value={settings.temperature}
            onChange={(v) => handleChange('temperature', v)}
            min={0}
            max={2}
            step={0.01}
          />

          <SliderInput
            label="Top P"
            description="Nucleus sampling: only consider tokens with cumulative probability above this."
            value={settings.top_p}
            onChange={(v) => handleChange('top_p', v)}
            min={0}
            max={1}
            step={0.01}
          />

          <SliderInput
            label="Top K"
            description="Only sample from the top K tokens. 0 disables this."
            value={settings.top_k}
            onChange={(v) => handleChange('top_k', v)}
            min={0}
            max={200}
            step={1}
          />

          <SliderInput
            label="Top A"
            description="Consider only tokens with attention above this threshold."
            value={settings.top_a}
            onChange={(v) => handleChange('top_a', v)}
            min={0}
            max={1}
            step={0.01}
          />

          <SliderInput
            label="Min P"
            description="Minimum probability for a token to be considered."
            value={settings.min_p}
            onChange={(v) => handleChange('min_p', v)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
      </Card>

      {/* Penalty Parameters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Penalty Parameters</h3>
        <div className="space-y-6">
          <SliderInput
            label="Frequency Penalty"
            description="Penalize tokens based on their frequency in the text so far."
            value={settings.frequency_penalty}
            onChange={(v) => handleChange('frequency_penalty', v)}
            min={-2}
            max={2}
            step={0.01}
          />

          <SliderInput
            label="Presence Penalty"
            description="Penalize tokens that have appeared in the text so far."
            value={settings.presence_penalty}
            onChange={(v) => handleChange('presence_penalty', v)}
            min={-2}
            max={2}
            step={0.01}
          />

          <SliderInput
            label="Repetition Penalty"
            description="Penalize repeated tokens. 1.0 means no penalty."
            value={settings.repetition_penalty}
            onChange={(v) => handleChange('repetition_penalty', v)}
            min={0.1}
            max={2}
            step={0.01}
          />
        </div>
      </Card>

      {/* Context and Token Limits */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Context & Token Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max_context">Max Context</Label>
            <Input
              id="max_context"
              type="number"
              value={settings.openai_max_context}
              onChange={(e) => handleChange('openai_max_context', parseInt(e.target.value) || 4096)}
              min={1}
            />
            <p className="text-xs text-gray-500">Maximum context window size</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_tokens">Max Response Tokens</Label>
            <Input
              id="max_tokens"
              type="number"
              value={settings.openai_max_tokens}
              onChange={(e) => handleChange('openai_max_tokens', parseInt(e.target.value) || 2048)}
              min={1}
            />
            <p className="text-xs text-gray-500">Maximum tokens in response</p>
          </div>
        </div>
      </Card>

      {/* Generation Settings */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Generation Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="seed">Seed</Label>
            <Input
              id="seed"
              type="number"
              value={settings.seed}
              onChange={(e) => handleChange('seed', parseInt(e.target.value) || -1)}
            />
            <p className="text-xs text-gray-500">-1 for random. Same seed = reproducible outputs</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n">Number of Completions</Label>
            <Input
              id="n"
              type="number"
              value={settings.n}
              onChange={(e) => handleChange('n', parseInt(e.target.value) || 1)}
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500">Number of completions to generate</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
