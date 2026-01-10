'use client';

import { useState, useCallback } from 'react';
import { STPromptBlock, STPromptOrder, STPromptOrderItem } from '@/types';
import { PromptBlockEditor } from './PromptBlockEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/storage';

interface PromptBlockListProps {
  blocks: STPromptBlock[];
  promptOrder: STPromptOrder[];
  onChange: (blocks: STPromptBlock[], promptOrder: STPromptOrder[]) => void;
  characterId?: number;
}

const MARKER_BLOCKS = [
  'main',
  'jailbreak',
  'nsfw',
  'dialogueExamples',
  'chatHistory',
  'worldInfoBefore',
  'worldInfoAfter',
  'charDescription',
  'charPersonality',
  'scenario',
  'personaDescription',
  'enhanceDefinitions',
];

export function PromptBlockList({
  blocks,
  promptOrder,
  onChange,
  characterId = 100001,
}: PromptBlockListProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get the order array for the current character
  const currentOrder = promptOrder.find((po) => po.character_id === characterId)?.order || [];

  // Sort blocks according to the order, separating active and inactive blocks
  const getSortedBlocks = useCallback(() => {
    const orderMap = new Map(currentOrder.map((item, index) => [item.identifier, { index, enabled: item.enabled }]));

    const orderedBlocks: Array<{ block: STPromptBlock; orderInfo?: { index: number; enabled: boolean } }> = [];
    const inactiveBlocks: STPromptBlock[] = [];

    blocks.forEach((block) => {
      const orderInfo = orderMap.get(block.identifier);
      if (orderInfo !== undefined) {
        orderedBlocks.push({ block, orderInfo });
      } else {
        inactiveBlocks.push(block);
      }
    });

    // Sort by order index
    orderedBlocks.sort((a, b) => (a.orderInfo?.index ?? 0) - (b.orderInfo?.index ?? 0));

    return {
      active: orderedBlocks.map((ob) => ({ block: ob.block, enabled: ob.orderInfo?.enabled ?? true })),
      inactive: inactiveBlocks.map((block) => ({ block, enabled: false })), // Inactive blocks are always disabled
    };
  }, [blocks, currentOrder]);

  const { active: activeBlocks, inactive: inactiveBlocks } = getSortedBlocks();
  const allBlocks = [...activeBlocks, ...inactiveBlocks];

  const isMarkerBlock = (identifier: string) => MARKER_BLOCKS.includes(identifier);

  const handleBlockChange = (updatedBlock: STPromptBlock) => {
    const newBlocks = blocks.map((b) =>
      b.identifier === updatedBlock.identifier ? updatedBlock : b
    );
    onChange(newBlocks, promptOrder);
    setEditingBlockId(null);
  };

  const handleBlockDelete = (identifier: string) => {
    const newBlocks = blocks.filter((b) => b.identifier !== identifier);
    const newPromptOrder = promptOrder.map((po) => ({
      ...po,
      order: po.order.filter((item) => item.identifier !== identifier),
    }));
    onChange(newBlocks, newPromptOrder);
    setEditingBlockId(null);
  };

  const handleAddBlock = (newBlock: STPromptBlock) => {
    const newBlocks = [...blocks, newBlock];

    // Add to prompt order for current character
    const newPromptOrder = promptOrder.map((po) => {
      if (po.character_id === characterId) {
        return {
          ...po,
          order: [...po.order, { identifier: newBlock.identifier, enabled: true }],
        };
      }
      return po;
    });

    // If no order exists for this character, create one
    if (!promptOrder.find((po) => po.character_id === characterId)) {
      newPromptOrder.push({
        character_id: characterId,
        order: [{ identifier: newBlock.identifier, enabled: true }],
      });
    }

    onChange(newBlocks, newPromptOrder);
    setIsAddingNew(false);
  };

  const handleToggleEnabled = (identifier: string) => {
    const newPromptOrder = promptOrder.map((po) => {
      if (po.character_id === characterId) {
        return {
          ...po,
          order: po.order.map((item) =>
            item.identifier === identifier ? { ...item, enabled: !item.enabled } : item
          ),
        };
      }
      return po;
    });
    onChange(blocks, newPromptOrder);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Check if we're dragging from inactive to active section or vice versa
    const isDraggingFromInactive = draggedIndex >= activeBlocks.length;
    const isDroppingInActive = index < activeBlocks.length;

    // Build new order from current visual order
    const reorderedIds = [...allBlocks.map((sb) => sb.block.identifier)];
    const draggedId = reorderedIds[draggedIndex];
    
    reorderedIds.splice(draggedIndex, 1);
    reorderedIds.splice(index, 0, draggedId);

    // Rebuild prompt order - only include blocks that should be active
    // Preserve existing enabled states, default to true for new active blocks
    const enabledMap = new Map(currentOrder.map((item) => [item.identifier, item.enabled]));
    const newOrderItems: STPromptOrderItem[] = reorderedIds
      .slice(0, activeBlocks.length + (isDroppingInActive ? 1 : 0)) // Only include active section
      .map((id) => ({
        identifier: id,
        enabled: enabledMap.get(id) ?? true, // Preserve existing state, default to true for new
      }));

    const newPromptOrder = promptOrder.map((po) => {
      if (po.character_id === characterId) {
        return { ...po, order: newOrderItems };
      }
      return po;
    });

    onChange(blocks, newPromptOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const createEmptyBlock = (): STPromptBlock => ({
    identifier: generateId(),
    name: 'New Block',
    role: 'system',
    content: '',
    system_prompt: false,
    marker: false,
    injection_position: 0,
    injection_depth: 4,
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'system':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      case 'assistant':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isAddingNew) {
    return (
      <PromptBlockEditor
        block={createEmptyBlock()}
        onChange={handleAddBlock}
        onDelete={() => setIsAddingNew(false)}
        onCancel={() => setIsAddingNew(false)}
        isNew
      />
    );
  }

  const editingBlock = editingBlockId
    ? blocks.find((b) => b.identifier === editingBlockId)
    : null;

  if (editingBlock) {
    return (
      <PromptBlockEditor
        block={editingBlock}
        onChange={handleBlockChange}
        onDelete={() => handleBlockDelete(editingBlock.identifier)}
        onCancel={() => setEditingBlockId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Prompt Blocks ({allBlocks.length})
        </h3>
        <Button onClick={() => setIsAddingNew(true)}>Add Block</Button>
      </div>

      {/* Active Blocks Section */}
      {activeBlocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active Blocks ({activeBlocks.length})
            </h4>
            <p className="text-xs text-gray-500">These blocks are included in the prompt order</p>
          </div>
          
          <div className="space-y-2">
            {activeBlocks.map(({ block, enabled }, index) => (
              <Card
                key={block.identifier}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'p-3 transition-all cursor-move',
                  !enabled && 'opacity-50',
                  draggedIndex === index && 'ring-2 ring-blue-500',
                  block.marker && 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Drag handle or lock icon for markers */}
                  <div className={cn("select-none", block.marker ? "text-amber-500" : "text-gray-400")}>
                    {block.marker ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    )}
                  </div>

                  {/* Enable/Disable toggle */}
                  <button
                    onClick={() => handleToggleEnabled(block.identifier)}
                    className={cn(
                      'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                      enabled
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-transparent'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>

                  {/* Block info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {block.name || block.identifier}
                      </span>
                      <Badge className={getRoleBadgeColor(block.role)}>
                        {block.role}
                      </Badge>
                      {block.marker && (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Marker
                        </Badge>
                      )}
                    </div>
                    {block.marker ? (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Dynamic content placeholder - cannot be edited
                      </p>
                    ) : block.content ? (
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {block.content.substring(0, 100)}...
                      </p>
                    ) : null}
                  </div>

                  {/* Edit button - only for non-markers */}
                  {!block.marker && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingBlockId(block.identifier)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Blocks Section */}
      {inactiveBlocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Inactive Blocks ({inactiveBlocks.length})
            </h4>
            <p className="text-xs text-gray-500">These blocks are available but not included in the prompt order</p>
          </div>
          
          <div className="space-y-2">
            {inactiveBlocks.map(({ block, enabled }, index) => {
              const actualIndex = activeBlocks.length + index;
              return (
                <Card
                  key={block.identifier}
                  draggable
                  onDragStart={() => handleDragStart(actualIndex)}
                  onDragOver={(e) => handleDragOver(e, actualIndex)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'p-3 transition-all cursor-move bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
                    !enabled && 'opacity-50',
                    draggedIndex === actualIndex && 'ring-2 ring-blue-500',
                    block.marker && 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag handle or lock icon for markers */}
                    <div className={cn("select-none", block.marker ? "text-amber-500" : "text-gray-400")}>
                      {block.marker ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      )}
                    </div>

                    {/* Enable/Disable toggle - disabled for inactive blocks */}
                    <button
                      onClick={() => handleToggleEnabled(block.identifier)}
                      disabled
                      className={cn(
                        'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors cursor-not-allowed',
                        'bg-gray-200 border-gray-300 text-gray-400'
                      )}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>

                    {/* Block info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {block.name || block.identifier}
                        </span>
                        <Badge className={getRoleBadgeColor(block.role)}>
                          {block.role}
                        </Badge>
                        {block.marker && (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Marker
                          </Badge>
                        )}
                      </div>
                      {block.marker ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          Dynamic content placeholder - cannot be edited
                        </p>
                      ) : block.content ? (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {block.content.substring(0, 100)}...
                        </p>
                      ) : null}
                    </div>

                    {/* Edit button - only for non-markers */}
                    {!block.marker && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingBlockId(block.identifier)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {allBlocks.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No prompt blocks yet. Click "Add Block" to create one.
        </Card>
      )}
    </div>
  );
}
