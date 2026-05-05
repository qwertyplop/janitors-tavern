import type { RegexScript } from './types.js';
import type { MacroContext } from './macros.js';
import { processMacros } from './macros.js';

export function parseFindRegex(findRegex: string): { pattern: string; flags: string } {
  if (findRegex.startsWith('/') && findRegex.lastIndexOf('/') > 0) {
    const lastSlash = findRegex.lastIndexOf('/');
    let pattern = findRegex.slice(1, lastSlash).replace(/\\\//g, '/');
    const flags = findRegex.slice(lastSlash + 1);
    return { pattern, flags };
  }
  return { pattern: findRegex, flags: '' };
}

export function safeRegex(pattern: string, flags: string): RegExp | null {
  try { return new RegExp(pattern, flags); } catch { return null; }
}

function applyTrimStrings(text: string, trimStrings: string[]): string {
  let result = text;
  for (const trim of trimStrings) result = result.replace(new RegExp(trim, 'g'), '');
  return result;
}

function substituteMacrosInFindRegex(findRegex: string, substituteRegex: 0 | 1 | 2, context: MacroContext): string {
  if (substituteRegex === 0) return findRegex;
  const substituted = processMacros(findRegex, context);
  if (substituteRegex === 2) return substituted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return substituted;
}

function hasMarkdown(content: string): boolean {
  return [/\*\*[^*]+\*\*/, /\*[^*]+\*/, /`[^`]+`/, /^#+\s/m, /^>\s/m, /^[-*+]\s/m, /\[[^\]]+\]\([^)]+\)/]
    .some(p => p.test(content));
}

export function applyRegexScript(
  content: string,
  script: RegexScript,
  context: MacroContext,
  depth?: number,
  role?: 'system' | 'user' | 'assistant'
): string {
  if (script.disabled) return content;

  if (script.roles && role) {
    if (!script.roles.includes(role)) return content;
  } else if (!script.roles && role === 'system') {
    return content;
  }

  if (depth !== undefined) {
    if (script.minDepth !== null && depth < script.minDepth) return content;
    if (script.maxDepth !== null && depth > script.maxDepth) return content;
  }

  if (script.markdownOnly && !hasMarkdown(content)) return content;

  const findRegex = substituteMacrosInFindRegex(script.findRegex, script.substituteRegex, context);
  const { pattern, flags } = parseFindRegex(findRegex);
  const regex = safeRegex(pattern, flags);
  if (!regex) return content;

  return content.replace(regex, (match, ...groups) => {
    const trimmedMatch = applyTrimStrings(match, script.trimStrings);
    let temp = script.replaceString.replace(/\{\{match\}\}/g, trimmedMatch);
    for (let i = 0; i < groups.length; i++) {
      temp = temp.replace(new RegExp(`\\$${i + 1}`, 'g'), String(groups[i] || ''));
    }
    return temp;
  });
}

export function applyRegexScripts(
  content: string,
  scripts: RegexScript[],
  context: MacroContext,
  placement: number,
  depth?: number,
  role?: 'system' | 'user' | 'assistant'
): string {
  let result = content;
  const filtered = scripts.filter(s => s.placement.includes(placement)).sort((a, b) => a.order - b.order);
  for (const script of filtered) result = applyRegexScript(result, script, context, depth, role);
  return result;
}
