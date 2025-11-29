import { ChatProvider, ProviderConfig } from './base';
import { OpenAICompatibleProvider } from './openai-compatible';
import { CustomHTTPProvider } from './custom-http';
import { JanitorAIProvider } from './janitorai';
import { ProviderType, ConnectionPreset } from '@/types';

export { ChatProvider } from './base';
export type { ProviderConfig } from './base';
export { OpenAICompatibleProvider } from './openai-compatible';
export { CustomHTTPProvider } from './custom-http';
export { JanitorAIProvider } from './janitorai';

export function createProvider(
  type: ProviderType,
  config: ProviderConfig
): ChatProvider {
  switch (type) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    case 'custom-http':
      return new CustomHTTPProvider(config);
    case 'janitorai':
      return new JanitorAIProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

export function createProviderFromPreset(
  preset: ConnectionPreset,
  apiKey: string
): ChatProvider {
  const config: ProviderConfig = {
    baseUrl: preset.baseUrl,
    apiKey,
    model: preset.model,
    extraHeaders: preset.extraHeaders,
    extraQueryParams: preset.extraQueryParams,
  };

  return createProvider(preset.providerType, config);
}
