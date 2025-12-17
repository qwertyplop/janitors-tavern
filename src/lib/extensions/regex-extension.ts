/**
 * Regex Extension Processor
 * Processes chat messages using regex scripts as part of the extensions pipeline
 */

import { RegexExtension, RegexScript } from '@/types';
import { processChatHistoryWithRegex } from '../regex-processor';
import { JanitorMessage } from '../janitor-parser';

export class RegexExtensionProcessor {
  private extension: RegexExtension;

  constructor(extension: RegexExtension) {
    this.extension = extension;
  }

  /**
   * Process messages using the regex extension
   */
  public processMessages(messages: JanitorMessage[]): JanitorMessage[] {
    if (!this.extension.enabled) {
      return messages;
    }

    const config = this.extension.config;
    const allScripts = config.scripts || [];

    // Filter enabled scripts if enabledScripts is specified
    const scriptsToApply = this.getEnabledScripts(allScripts, config.enabledScripts);

    if (scriptsToApply.length === 0) {
      return messages;
    }

    // Apply regex processing to chat history (non-system messages)
    const systemMessages = messages.filter(m => m.role === 'system');
    const chatHistory = messages.filter(m => m.role !== 'system');

    const processedChatHistory = processChatHistoryWithRegex(chatHistory, {
      scripts: scriptsToApply,
      skipPresetProcessing: true
    });

    return [...systemMessages, ...processedChatHistory];
  }

  /**
   * Get enabled scripts based on configuration
   */
  private getEnabledScripts(
    allScripts: RegexScript[],
    enabledScriptIds?: string[]
  ): RegexScript[] {
    if (!enabledScriptIds || enabledScriptIds.length === 0) {
      // If no specific enabled scripts, use all that have enabled: true or default to true
      return allScripts.filter(script => script.enabled !== false);
    }

    // Use only scripts that are in the enabledScripts list
    return allScripts.filter(script => enabledScriptIds.includes(script.id));
  }

  /**
   * Add a new regex script to the extension
   */
  public addScript(script: Omit<RegexScript, 'id'> & { id?: string }): RegexScript {
    const newScript: RegexScript = {
      id: script.id || this.generateScriptId(),
      name: script.name,
      description: script.description,
      pattern: script.pattern,
      replacement: script.replacement,
      flags: script.flags || '',
      enabled: script.enabled !== false, // default to true
      order: script.order || 0
    };

    this.extension.config.scripts.push(newScript);
    return newScript;
  }

  /**
   * Update an existing script
   */
  public updateScript(scriptId: string, updates: Partial<RegexScript>): boolean {
    const scriptIndex = this.extension.config.scripts.findIndex(s => s.id === scriptId);
    if (scriptIndex === -1) return false;

    this.extension.config.scripts[scriptIndex] = {
      ...this.extension.config.scripts[scriptIndex],
      ...updates
    };
    return true;
  }

  /**
   * Remove a script by ID
   */
  public removeScript(scriptId: string): boolean {
    const initialLength = this.extension.config.scripts.length;
    this.extension.config.scripts = this.extension.config.scripts.filter(s => s.id !== scriptId);
    return this.extension.config.scripts.length < initialLength;
  }

  /**
   * Toggle script enabled state
   */
  public toggleScript(scriptId: string): boolean {
    const script = this.extension.config.scripts.find(s => s.id === scriptId);
    if (!script) return false;

    script.enabled = !script.enabled;
    return script.enabled;
  }

  /**
   * Generate a unique script ID
   */
  private generateScriptId(): string {
    return `regex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Import scripts from JSON
   */
  public importScriptsFromJson(jsonContent: string): { success: boolean, count: number, error?: string } {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: 'Expected an array of scripts' };
      }

      const importedCount = parsed.length;
      for (const scriptData of parsed) {
        this.addScript(scriptData);
      }

      return { success: true, count: importedCount };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export scripts to JSON
   */
  public exportScriptsToJson(): string {
    return JSON.stringify(this.extension.config.scripts, null, 2);
  }
}