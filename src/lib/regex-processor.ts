/**
 * Regex Processor for Chat History
 * Processes chat history using regex scripts before it's used in prompt building
 */

import type { JanitorMessage } from './janitor-parser';

export interface RegexScript {
  name: string;
  description?: string;
  pattern: string;
  replacement: string;
  flags?: string;
  enabled?: boolean;
}

export interface RegexScriptCollection {
  scripts: RegexScript[];
  version?: string;
  description?: string;
}

export interface RegexProcessingOptions {
  scripts?: RegexScript[];
  skipPresetProcessing?: boolean;
}

/**
 * Apply regex processing to chat history
 */
export function processChatHistoryWithRegex(
  chatHistory: JanitorMessage[],
  options: RegexProcessingOptions = {}
): JanitorMessage[] {
  const { scripts = [], skipPresetProcessing = false } = options;

  if (scripts.length === 0) {
    return chatHistory;
  }

  return chatHistory.map(message => {
    let processedContent = message.content;

    // Apply each regex script to the content
    for (const script of scripts) {
      if (script.enabled === false) continue;

      try {
        const regex = new RegExp(script.pattern, script.flags);
        processedContent = processedContent.replace(regex, script.replacement);
      } catch (error) {
        console.error(`Regex processing error in script "${script.name}":`, error);
        // Continue with other scripts even if one fails
      }
    }

    return {
      ...message,
      content: processedContent
    };
  });
}

/**
 * Import regex scripts from JSON (SillyTavern format)
 */
export async function importRegexScriptsFromJson(jsonContent: string): Promise<RegexScriptCollection> {
  try {
    const parsed = JSON.parse(jsonContent);

    // Handle both single script and array of scripts in ST format
    let scripts: RegexScript[] = [];

    if (Array.isArray(parsed)) {
      // Array of ST format scripts
      scripts = parsed.map((stScript: any) => ({
        name: stScript.scriptName || 'Unnamed Script',
        description: stScript.description || '',
        pattern: stScript.findRegex || '',
        replacement: stScript.replaceString || '',
        flags: 'g', // Default flag
        enabled: stScript.disabled !== true
      }));
    } else if (parsed.scriptName && parsed.findRegex) {
      // Single ST format script
      scripts = [{
        name: parsed.scriptName,
        description: parsed.description || '',
        pattern: parsed.findRegex,
        replacement: parsed.replaceString || '',
        flags: 'g', // Default flag
        enabled: parsed.disabled !== true
      }];
    } else {
      console.error('Invalid SillyTavern regex script format');
      return {
        scripts: [],
        version: '1.0',
        description: 'Invalid ST format'
      };
    }

    return {
      scripts: scripts,
      version: '1.0',
      description: 'Imported from SillyTavern format'
    };
  } catch (error) {
    console.error('Error parsing regex scripts JSON:', error);
    return {
      scripts: [],
      version: '1.0',
      description: 'Invalid JSON'
    };
  }
}

/**
 * Export regex scripts to JSON
 */
export function exportRegexScriptsToJson(collection: RegexScriptCollection): string {
  return JSON.stringify(collection, null, 2);
}