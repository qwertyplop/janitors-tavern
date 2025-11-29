/**
 * STScript Macro Processor
 * Handles SillyTavern-compatible macro replacement in prompt blocks and other content.
 * Based on: https://docs.sillytavern.app/usage/core-concepts/macros/
 */

// ============================================
// Macro Context Types
// ============================================

export interface ChatVariables {
  local: Map<string, string | number>;
  global: Map<string, string | number>;
}

export interface MacroContext {
  // Character info
  char?: string;
  charDescription?: string;
  charPersonality?: string;
  charScenario?: string;
  charVersion?: string;
  charPrompt?: string;
  charJailbreak?: string;
  charDepthPrompt?: string;
  mesExamples?: string;
  mesExamplesRaw?: string;

  // User info
  user?: string;
  persona?: string;

  // Group info
  group?: string[];
  groupNotMuted?: string[];
  notChar?: string[];

  // Chat history info
  lastMessage?: string;
  lastMessageId?: number;
  lastCharMessage?: string;
  lastUserMessage?: string;
  firstIncludedMessageId?: number;
  currentSwipeId?: number;
  lastSwipeId?: number;
  lastGenerationType?: 'normal' | 'impersonate' | 'regenerate' | 'quiet' | 'swipe' | 'continue';

  // Model info
  model?: string;

  // Input
  input?: string;

  // Idle duration (in milliseconds since last user message)
  idleDuration?: number;

  // Chat variables
  variables?: ChatVariables;

  // Extension data
  summary?: string;
  authorsNote?: string;
  charAuthorsNote?: string;
  defaultAuthorsNote?: string;

  // World Info outlets
  outlets?: Map<string, string>;
}

// ============================================
// Default Context
// ============================================

export function createDefaultMacroContext(): MacroContext {
  return {
    char: '',
    user: '',
    variables: {
      local: new Map(),
      global: new Map(),
    },
    outlets: new Map(),
  };
}

// ============================================
// Date/Time Helpers
// ============================================

function getCurrentTime(): string {
  return new Date().toLocaleTimeString();
}

function getCurrentDate(): string {
  return new Date().toLocaleDateString();
}

function getISOTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 5); // HH:MM format
}

function getISODate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getWeekday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getTimeWithOffset(offset: number): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const targetTime = new Date(utc + (3600000 * offset));
  return targetTime.toLocaleTimeString();
}

function formatDateTime(format: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');

  return format
    .replace(/YYYY/g, now.getFullYear().toString())
    .replace(/YY/g, now.getFullYear().toString().slice(-2))
    .replace(/MM/g, pad(now.getMonth() + 1))
    .replace(/DD/g, pad(now.getDate()))
    .replace(/HH/g, pad(now.getHours()))
    .replace(/hh/g, pad(now.getHours() % 12 || 12))
    .replace(/mm/g, pad(now.getMinutes()))
    .replace(/ss/g, pad(now.getSeconds()))
    .replace(/A/g, now.getHours() >= 12 ? 'PM' : 'AM')
    .replace(/a/g, now.getHours() >= 12 ? 'pm' : 'am')
    .replace(/MMMM/g, now.toLocaleDateString('en-US', { month: 'long' }))
    .replace(/MMM/g, now.toLocaleDateString('en-US', { month: 'short' }))
    .replace(/dddd/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
    .replace(/ddd/g, now.toLocaleDateString('en-US', { weekday: 'short' }));
}

function humanizeDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

// ============================================
// Random/Roll Helpers
// ============================================

function processRandom(args: string): string {
  const items = args.split(',').map(s => s.trim());
  if (items.length === 0) return '';
  return items[Math.floor(Math.random() * items.length)];
}

function processRandomAlt(args: string): string {
  const items = args.split('::').map(s => s.trim());
  if (items.length === 0) return '';
  return items[Math.floor(Math.random() * items.length)];
}

function processPick(args: string, sourceHash: number): string {
  const items = args.split('::').map(s => s.trim());
  if (items.length === 0) return '';
  // Use a stable selection based on the source hash
  const index = Math.abs(sourceHash) % items.length;
  return items[index];
}

function processRoll(formula: string): string {
  // Parse D&D dice syntax: XdY+Z or dY or XdY
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return formula;

  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  let total = modifier;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return total.toString();
}

// ============================================
// Variable Helpers
// ============================================

function getVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const value = map.get(name);
  return value !== undefined ? String(value) : '';
}

function setVar(variables: ChatVariables | undefined, name: string, value: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  map.set(name, value);
  return '';
}

function addVar(variables: ChatVariables | undefined, name: string, increment: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const current = Number(map.get(name)) || 0;
  const add = Number(increment) || 0;
  map.set(name, current + add);
  return '';
}

function incVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const current = Number(map.get(name)) || 0;
  map.set(name, current + 1);
  return (current + 1).toString();
}

function decVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const current = Number(map.get(name)) || 0;
  map.set(name, current - 1);
  return (current - 1).toString();
}

// ============================================
// String hash for stable pick
// ============================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// ============================================
// Main Macro Processor
// ============================================

export function processMacros(content: string, context: MacroContext = {}): string {
  if (!content) return content;

  let result = content;
  const sourceHash = hashString(content);

  // Process macros iteratively (some may produce other macros, but we don't support nesting)
  // Match {{...}} patterns
  const macroRegex = /\{\{([^{}]+)\}\}/gi;

  result = result.replace(macroRegex, (match, inner) => {
    const macroContent = inner.trim();
    const macroLower = macroContent.toLowerCase();

    // ========== Comment/Note macros ==========
    if (macroLower.startsWith('//')) {
      return ''; // Comment, returns empty
    }

    // ========== Simple replacement macros ==========
    if (macroLower === 'pipe') return ''; // Only for slash command batching
    if (macroLower === 'newline') return '\n';
    if (macroLower === 'trim') return ''; // Will be handled separately
    if (macroLower === 'noop') return '';

    // User/Character macros
    if (macroLower === 'user' || macroContent === '<USER>') return context.user || '';
    if (macroLower === 'char' || macroContent === '<BOT>') return context.char || '';
    if (macroLower === 'description') return context.charDescription || '';
    if (macroLower === 'scenario') return context.charScenario || '';
    if (macroLower === 'personality') return context.charPersonality || '';
    if (macroLower === 'persona') return context.persona || '';
    if (macroLower === 'mesexamples') return context.mesExamples || '';
    if (macroLower === 'mesexamplesraw') return context.mesExamplesRaw || '';
    if (macroLower === 'charversion') return context.charVersion || '';
    if (macroLower === 'chardepthprompt') return context.charDepthPrompt || '';
    if (macroLower === 'charprompt') return context.charPrompt || '';
    if (macroLower === 'charjailbreak') return context.charJailbreak || '';

    // Group macros
    if (macroLower === 'group' || macroLower === 'charifnotgroup') {
      return context.group?.join(', ') || context.char || '';
    }
    if (macroLower === 'groupnotmuted') {
      return context.groupNotMuted?.join(', ') || context.group?.join(', ') || '';
    }
    if (macroLower === 'notchar') {
      return context.notChar?.join(', ') || '';
    }

    // Chat history macros
    if (macroLower === 'lastmessageid') return context.lastMessageId?.toString() || '';
    if (macroLower === 'lastmessage') return context.lastMessage || '';
    if (macroLower === 'firstincludedmessageid') return context.firstIncludedMessageId?.toString() || '';
    if (macroLower === 'lastcharmessage') return context.lastCharMessage || '';
    if (macroLower === 'lastusermessage') return context.lastUserMessage || '';
    if (macroLower === 'currentswipeid') return context.currentSwipeId?.toString() || '1';
    if (macroLower === 'lastswipeid') return context.lastSwipeId?.toString() || '1';
    if (macroLower === 'lastgenerationtype') return context.lastGenerationType || 'normal';

    // Model macro
    if (macroLower === 'model') return context.model || '';

    // Input macro
    if (macroLower === 'input') return context.input || '';

    // Original macro (for prompt overrides)
    if (macroLower === 'original') return ''; // Placeholder, handled by prompt processor

    // ========== Date/Time macros ==========
    if (macroLower === 'time') return getCurrentTime();
    if (macroLower === 'date') return getCurrentDate();
    if (macroLower === 'weekday') return getWeekday();
    if (macroLower === 'isotime') return getISOTime();
    if (macroLower === 'isodate') return getISODate();
    if (macroLower === 'idle_duration') {
      return context.idleDuration ? humanizeDuration(context.idleDuration) : '';
    }

    // Time with UTC offset: {{time_UTC+X}} or {{time_UTC-X}}
    const timeUtcMatch = macroLower.match(/^time_utc([+-])(\d+)$/);
    if (timeUtcMatch) {
      const sign = timeUtcMatch[1] === '+' ? 1 : -1;
      const offset = parseInt(timeUtcMatch[2]) * sign;
      return getTimeWithOffset(offset);
    }

    // Datetime format: {{datetimeformat ...}}
    if (macroLower.startsWith('datetimeformat ')) {
      const format = macroContent.slice(15).trim();
      return formatDateTime(format);
    }

    // ========== Random/Roll macros ==========
    // {{random:a,b,c}} or {{random::a::b::c}}
    if (macroLower.startsWith('random:')) {
      const args = macroContent.slice(7);
      if (args.includes('::')) {
        return processRandomAlt(args);
      }
      return processRandom(args);
    }

    // {{pick::a::b::c}}
    if (macroLower.startsWith('pick::')) {
      const args = macroContent.slice(6);
      return processPick(args, sourceHash);
    }

    // {{roll:XdY+Z}}
    if (macroLower.startsWith('roll:')) {
      const formula = macroContent.slice(5).trim();
      return processRoll(formula);
    }

    // ========== Variable macros ==========
    // Local variables
    if (macroLower.startsWith('getvar::')) {
      const name = macroContent.slice(8);
      return getVar(context.variables, name, false);
    }
    if (macroLower.startsWith('setvar::')) {
      const parts = macroContent.slice(8).split('::');
      if (parts.length >= 2) {
        return setVar(context.variables, parts[0], parts.slice(1).join('::'), false);
      }
      return '';
    }
    if (macroLower.startsWith('addvar::')) {
      const parts = macroContent.slice(8).split('::');
      if (parts.length >= 2) {
        return addVar(context.variables, parts[0], parts[1], false);
      }
      return '';
    }
    if (macroLower.startsWith('incvar::')) {
      const name = macroContent.slice(8);
      return incVar(context.variables, name, false);
    }
    if (macroLower.startsWith('decvar::')) {
      const name = macroContent.slice(8);
      return decVar(context.variables, name, false);
    }

    // Global variables
    if (macroLower.startsWith('getglobalvar::')) {
      const name = macroContent.slice(14);
      return getVar(context.variables, name, true);
    }
    if (macroLower.startsWith('setglobalvar::')) {
      const parts = macroContent.slice(14).split('::');
      if (parts.length >= 2) {
        return setVar(context.variables, parts[0], parts.slice(1).join('::'), true);
      }
      return '';
    }
    if (macroLower.startsWith('addglobalvar::')) {
      const parts = macroContent.slice(14).split('::');
      if (parts.length >= 2) {
        return addVar(context.variables, parts[0], parts[1], true);
      }
      return '';
    }
    if (macroLower.startsWith('incglobalvar::')) {
      const name = macroContent.slice(14);
      return incVar(context.variables, name, true);
    }
    if (macroLower.startsWith('decglobalvar::')) {
      const name = macroContent.slice(14);
      return decVar(context.variables, name, true);
    }

    // Scoped variable (STscript only): {{var::name}} or {{var::name::index}}
    if (macroLower.startsWith('var::')) {
      const parts = macroContent.slice(5).split('::');
      const name = parts[0];
      // For now, treat scoped vars as local vars
      return getVar(context.variables, name, false);
    }

    // ========== String manipulation macros ==========
    if (macroLower.startsWith('reverse:')) {
      const content = macroContent.slice(8);
      // Remove surrounding parentheses if present
      const inner = content.startsWith('(') && content.endsWith(')')
        ? content.slice(1, -1)
        : content;
      return inner.split('').reverse().join('');
    }

    // ========== Extension macros ==========
    if (macroLower === 'summary') return context.summary || '';
    if (macroLower === 'authorsnote') return context.authorsNote || '';
    if (macroLower === 'charauthorsnote') return context.charAuthorsNote || '';
    if (macroLower === 'defaultauthorsnote') return context.defaultAuthorsNote || '';

    // World Info outlet: {{outlet::name}}
    if (macroLower.startsWith('outlet::')) {
      const name = macroContent.slice(8);
      return context.outlets?.get(name) || '';
    }

    // ========== Bias/Banned (placeholder - requires backend support) ==========
    if (macroLower.startsWith('bias ')) {
      // Extract the quoted text - this would be used by the backend
      return ''; // Returns empty, but the bias would be recorded
    }
    if (macroLower.startsWith('banned ')) {
      // Extract the quoted text - this would be used by the backend
      return ''; // Returns empty, but the banned word would be recorded
    }

    // ========== TimeDiff macro ==========
    if (macroLower.startsWith('timediff::')) {
      // {{timeDiff::(time1)::(time2)}}
      // This is complex and would need proper time parsing
      // For now, return the original
      return match;
    }

    // If no macro matched, return original
    return match;
  });

  // Handle {{trim}} - remove surrounding newlines
  result = result.replace(/\n*\{\{trim\}\}\n*/gi, '');

  return result;
}

// ============================================
// Process Array of Prompt Blocks
// ============================================

import type { STPromptBlock } from '@/types';

export function processPromptBlockMacros(
  blocks: STPromptBlock[],
  context: MacroContext
): STPromptBlock[] {
  return blocks.map(block => ({
    ...block,
    content: processMacros(block.content, context),
    name: processMacros(block.name, context),
  }));
}

// ============================================
// Export utilities
// ============================================

export const macroUtils = {
  processMacros,
  processPromptBlockMacros,
  createDefaultMacroContext,
  formatDateTime,
  humanizeDuration,
  processRoll,
  processRandom,
};
