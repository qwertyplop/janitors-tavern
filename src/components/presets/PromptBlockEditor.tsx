'use client';

import { useState } from 'react';
import { STPromptBlock, PromptBlockRole, PromptTrigger } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface PromptBlockEditorProps {
  block: STPromptBlock;
  onChange: (block: STPromptBlock) => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew?: boolean;
}

const TRIGGER_OPTIONS: { value: PromptTrigger; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Regular message generation request' },
  { value: 'continue', label: 'Continue', description: 'When Continue button is pressed' },
  { value: 'impersonate', label: 'Impersonate', description: 'When Impersonate button is pressed' },
  { value: 'swipe', label: 'Swipe', description: 'When triggered by swiping' },
  { value: 'regenerate', label: 'Regenerate', description: 'When Regenerate button is pressed (solo chats only)' },
  { value: 'quiet', label: 'Quiet', description: 'Background generation (extensions/scripts)' },
];

export function PromptBlockEditor({
  block,
  onChange,
  onDelete,
  onCancel,
  isNew = false,
}: PromptBlockEditorProps) {
  const [editedBlock, setEditedBlock] = useState<STPromptBlock>({ ...block });

  const handleChange = <K extends keyof STPromptBlock>(
    key: K,
    value: STPromptBlock[K]
  ) => {
    setEditedBlock((prev) => ({ ...prev, [key]: value }));
  };

  const handleTriggerToggle = (trigger: PromptTrigger) => {
    const currentTriggers = editedBlock.triggers || [];
    const newTriggers = currentTriggers.includes(trigger)
      ? currentTriggers.filter((t) => t !== trigger)
      : [...currentTriggers, trigger];
    handleChange('triggers', newTriggers.length > 0 ? newTriggers : undefined);
  };

  const handleSave = () => {
    onChange(editedBlock);
  };

  const isInChatPosition = editedBlock.injection_position === 1;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isNew ? 'New Prompt Block' : 'Edit Prompt Block'}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            {isNew ? 'Add Block' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          Basic Information
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={editedBlock.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Block name (for reference only)"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Not sent to the model; for your reference in the Prompt Manager only.
            </p>
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              value={editedBlock.role}
              onChange={(e) => handleChange('role', e.target.value as PromptBlockRole)}
            >
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">AI Assistant</option>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              Which role sends the prompt.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={editedBlock.content}
          onChange={(e) => handleChange('content', e.target.value)}
          placeholder="Prompt content..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>

      {/* Triggers */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          Triggers
        </h4>
        <p className="text-xs text-zinc-500">
          Select the generation types for which this prompt is sent. If nothing is selected, it will be sent for all types.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {TRIGGER_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={editedBlock.triggers?.includes(option.value) || false}
                onChange={() => handleTriggerToggle(option.value)}
                className="w-4 h-4 rounded border-zinc-300"
              />
              <div>
                <span className="text-sm font-medium">{option.label}</span>
                <p className="text-xs text-zinc-500">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
        {(editedBlock.triggers?.length || 0) === 0 && (
          <p className="text-xs text-green-600 dark:text-green-400">
            No triggers selected - this prompt will be sent for all generation types.
          </p>
        )}
      </div>

      {/* Position & Depth */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          Position & Depth
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="injection_position">Position</Label>
            <Select
              value={String(editedBlock.injection_position)}
              onChange={(e) => handleChange('injection_position', parseInt(e.target.value))}
            >
              <option value="0">Relative</option>
              <option value="1">In-Chat</option>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              {isInChatPosition
                ? 'Sent within Chat History at the specified Depth.'
                : 'Sent in order with other prompts in the Prompt Manager.'}
            </p>
          </div>

          <div>
            <Label htmlFor="injection_depth">Depth</Label>
            <Input
              id="injection_depth"
              type="number"
              min={0}
              value={editedBlock.injection_depth}
              onChange={(e) => handleChange('injection_depth', parseInt(e.target.value) || 0)}
              disabled={!isInChatPosition}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {isInChatPosition
                ? '0 = after last message, 1 = before last, etc.'
                : 'Only used when Position is In-Chat.'}
            </p>
          </div>

          <div>
            <Label htmlFor="injection_order">Order</Label>
            <Input
              id="injection_order"
              type="number"
              value={editedBlock.injection_order ?? 0}
              onChange={(e) => handleChange('injection_order', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Order for prompts with same Role and Depth.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          Advanced Options
        </h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={editedBlock.system_prompt}
              onChange={(e) => handleChange('system_prompt', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div>
              <span className="text-sm font-medium">System Prompt</span>
              <p className="text-xs text-zinc-500">Mark as a system-level prompt</p>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={editedBlock.marker}
              onChange={(e) => handleChange('marker', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div>
              <span className="text-sm font-medium">Marker</span>
              <p className="text-xs text-zinc-500">Use as a position marker</p>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={editedBlock.forbid_overrides ?? false}
              onChange={(e) => handleChange('forbid_overrides', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div>
              <span className="text-sm font-medium">Forbid Overrides</span>
              <p className="text-xs text-zinc-500">Prevent character cards from overriding</p>
            </div>
          </label>
        </div>
      </div>

      <div className="pt-2 border-t flex justify-between">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          Delete Block
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            {isNew ? 'Add Block' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
