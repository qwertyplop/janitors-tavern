// ============================================
// Regex Script Processor
// ============================================
// Implements SillyTavern-style regex script support for Janitor's Tavern proxy.
// Supports placement filtering, depth filtering, macro substitution, and more.

import { RegexScript } from '@/types';
import { MacroContext, processMacros } from '@/lib/macros';

// ============================================
// Helper: Parse regex pattern and flags from findRegex string
// ============================================

/**
 * Extracts pattern and flags from a findRegex string like "/pattern/flags".
 * If the string does not start and end with '/', treats the whole string as pattern with no flags.
 * Returns an object with pattern and flags.
 *
 * Handles double-escaped patterns from imported SillyTavern regex scripts.
 */
export function parseFindRegex(findRegex: string): { pattern: string; flags: string } {
  if (findRegex.startsWith('/') && findRegex.lastIndexOf('/') > 0) {
    const lastSlash = findRegex.lastIndexOf('/');
    let pattern = findRegex.slice(1, lastSlash);
    const flags = findRegex.slice(lastSlash + 1);

    // Handle double-escaped patterns from SillyTavern exports
    // Convert \\/ to \/ in the pattern to fix escaped forward slashes
    pattern = pattern.replace(/\\\//g, '/');

    return { pattern, flags };
  }
  // No slashes, treat as plain pattern with no flags
  return { pattern: findRegex, flags: '' };
}

/**
 * Compiles a regex from pattern and flags, with error handling.
 * Returns null if regex is invalid.
 */
export function safeRegex(pattern: string, flags: string): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

// ============================================
// Helper: Apply trimStrings to matched text
// ============================================

function applyTrimStrings(text: string, trimStrings: string[]): string {
  let result = text;
  for (const trim of trimStrings) {
    result = result.replace(new RegExp(trim, 'g'), '');
  }
  return result;
}

// ============================================
// Helper: Substitute macros in findRegex according to substituteRegex flag
// ============================================

function substituteMacrosInFindRegex(
  findRegex: string,
  substituteRegex: 0 | 1 | 2,
  context: MacroContext
): string {
  if (substituteRegex === 0) {
    return findRegex;
  }
  // Substitute macros using processMacros
  const substituted = processMacros(findRegex, context);
  if (substituteRegex === 2) {
    // Escape regex special characters in the substituted result
    return substituted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return substituted;
}

// ============================================
// Helper: Check if content contains markdown (simple detection)
// ============================================

function hasMarkdown(content: string): boolean {
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,      // bold
    /\*[^*]+\*/,          // italic
    /`[^`]+`/,           // inline code
    /^#+\s/m,            // headings
    /^>\s/m,             // blockquote
    /^[-*+]\s/m,         // list
    /\[[^\]]+\]\([^)]+\)/, // links
  ];
  return markdownPatterns.some(p => p.test(content));
}

// ============================================
// Main function: Apply a single regex script to content
// ============================================

export function applyRegexScript(
  content: string,
  script: RegexScript,
  context: MacroContext,
  depth?: number,
  role?: 'system' | 'user' | 'assistant'
): string {
  // Skip if disabled
  if (script.disabled) {
    return content;
  }

  // Role filtering - if roles are specified, only apply to matching roles
  if (script.roles && role) {
    if (!script.roles.includes(role)) {
      return content;
    }
  } else if (!script.roles && role) {
    // Default behavior: apply to assistant and user roles, but not system
    if (role === 'system') {
      return content;
    }
  }

  // Depth filtering
  if (depth !== undefined) {
    if (script.minDepth !== null && depth < script.minDepth) {
      return content;
    }
    if (script.maxDepth !== null && depth > script.maxDepth) {
      return content;
    }
  }

  // Markdown only filtering
  if (script.markdownOnly && !hasMarkdown(content)) {
    return content;
  }

  // Substitute macros in findRegex if needed
  const findRegex = substituteMacrosInFindRegex(script.findRegex, script.substituteRegex, context);
  const { pattern, flags } = parseFindRegex(findRegex);
  const regex = safeRegex(pattern, flags);
  if (!regex) {
    // Invalid regex, skip
    return content;
  }

  // Perform replacement
  const result = content.replace(regex, (match, ...groups) => {
    // Apply trimStrings to the matched text
    const trimmedMatch = applyTrimStrings(match, script.trimStrings);

    // Build replacement string
    let temp = script.replaceString;
    // Replace {{match}} with trimmed match
    temp = temp.replace(/\{\{match\}\}/g, trimmedMatch);
    // Replace $1, $2, ... $9
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i] || '';
      temp = temp.replace(new RegExp(`\\$${i + 1}`, 'g'), group);
    }
    return temp;
  });

  return result;
}

// ============================================
// Main function: Apply multiple regex scripts to content
// ============================================

export function applyRegexScripts(
  content: string,
  scripts: RegexScript[],
  context: MacroContext,
  placement: number,
  depth?: number,
  role?: 'system' | 'user' | 'assistant'
): string {
  let result = content;
  // Filter scripts by placement
  const filtered = scripts.filter(s => s.placement.includes(placement));
  for (const script of filtered) {
    result = applyRegexScript(result, script, context, depth, role);
  }
  return result;
}

// ============================================
// Load regex scripts from storage (server-side)
// ============================================

import { getServerRegexScripts } from '@/lib/server-storage';

export { getServerRegexScripts };