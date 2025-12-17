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
 * Import regex scripts from JSON
 */
export async function importRegexScriptsFromJson(jsonContent: string): Promise<RegexScriptCollection> {
  try {
    const parsed = JSON.parse(jsonContent);
    return {
      scripts: parsed.scripts || [],
      version: parsed.version,
      description: parsed.description
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