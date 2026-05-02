'use client';

import { useState } from 'react';
import { STPromptBlock, PromptBlockRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/components/providers/I18nProvider';

interface PromptBlockEditorProps {
  block: STPromptBlock;
  onChange: (block: STPromptBlock) => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew?: boolean;
}


export function PromptBlockEditor({
  block,
  onChange,
  onDelete,
  onCancel,
  isNew = false,
}: PromptBlockEditorProps) {
  const { t } = useI18n();
  const [editedBlock, setEditedBlock] = useState<STPromptBlock>({ ...block });

  const handleChange = <K extends keyof STPromptBlock>(
    key: K,
    value: STPromptBlock[K]
  ) => {
    setEditedBlock((prev) => ({ ...prev, [key]: value }));
  };


  const handleSave = () => {
    onChange(editedBlock);
  };

  const isInChatPosition = editedBlock.injection_position === 1;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isNew ? t.promptBlocks.newPromptBlock : t.promptBlocks.editPromptBlock}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t.promptBlocks.cancelButton}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {isNew ? t.promptBlocks.addBlockButtonEditor : t.common.save}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          {t.promptBlocks.basicInformation}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">{t.promptBlocks.blockName}</Label>
            <Input
              id="name"
              value={editedBlock.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t.promptBlocks.namePlaceholder}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t.promptBlocks.nameDescription}
            </p>
          </div>

          <div>
            <Label htmlFor="role">{t.promptBlocks.blockRole}</Label>
            <Select
              value={editedBlock.role}
              onChange={(e) => handleChange('role', e.target.value as PromptBlockRole)}
            >
              <option value="system">{t.promptBlocks.system}</option>
              <option value="user">{t.promptBlocks.user}</option>
              <option value="assistant">{t.promptBlocks.assistant}</option>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              {t.promptBlocks.roleDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <Label htmlFor="content">{t.promptBlocks.blockContent}</Label>
        <Textarea
          id="content"
          value={editedBlock.content}
          onChange={(e) => handleChange('content', e.target.value)}
          placeholder={t.promptBlocks.contentPlaceholder}
          className="min-h-[200px] font-mono text-sm"
        />
      </div>


      {/* Position & Depth */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b pb-2">
          {t.promptBlocks.positionDepth}
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="injection_position">{t.promptBlocks.position}</Label>
            <Select
              value={String(editedBlock.injection_position)}
              onChange={(e) => handleChange('injection_position', parseInt(e.target.value))}
            >
              <option value="0">{t.promptBlocks.positionRelative}</option>
              <option value="1">{t.promptBlocks.positionInChat}</option>
            </Select>
            <p className="text-xs text-zinc-500 mt-1">
              {isInChatPosition
                ? t.promptBlocks.positionDescriptionInChat
                : t.promptBlocks.positionDescriptionRelative}
            </p>
          </div>

          <div>
            <Label htmlFor="injection_depth">{t.promptBlocks.depth}</Label>
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
                ? t.promptBlocks.depthDescriptionInChat
                : t.promptBlocks.depthDescriptionRelative}
            </p>
          </div>

          <div>
            <Label htmlFor="injection_order">{t.promptBlocks.order}</Label>
            <Input
              id="injection_order"
              type="number"
              value={editedBlock.injection_order ?? 0}
              onChange={(e) => handleChange('injection_order', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t.promptBlocks.orderDescription}
            </p>
          </div>
        </div>
      </div>


      <div className="pt-2 border-t flex justify-between">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          {t.promptBlocks.deleteBlockButton}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t.promptBlocks.cancelButton}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {isNew ? t.promptBlocks.addBlockButtonEditor : t.promptBlocks.saveChangesButton}
          </Button>
        </div>
      </div>
    </Card>
  );
}
