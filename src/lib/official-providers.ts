/**
 * Official Providers - Hardcoded default direct model providers
 * These are pre-configured providers that users can quickly add to their connections
 */

import { ConnectionPreset, ProviderType } from '@/types';

export interface OfficialProvider {
  /** Unique identifier for the provider */
  id: string;
  /** Display name */
  name: string;
  /** Provider type */
  providerType: ProviderType;
  /** Base API URL */
  baseUrl: string;
  /** Documentation URL */
  docsUrl?: string;
  /** Website URL */
  websiteUrl?: string;
  /** Icon name or URL */
  icon?: string;
  /** Description of the provider */
  description?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Whether API key is required */
  apiKeyRequired: boolean;
  /** Example API key format */
  apiKeyFormat?: string;
  /** Whether this provider supports the models endpoint */
  supportsModelsEndpoint: boolean;
  /** Recommended settings */
  recommendedSettings?: Partial<ConnectionPreset>;
}

/**
 * List of official providers as specified by the user
 */
export const OFFICIAL_PROVIDERS: OfficialProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.anthropic.com',
    docsUrl: 'https://docs.anthropic.com',
    websiteUrl: 'https://www.anthropic.com',
    icon: '🤖',
    description: 'Claude AI models',
    defaultModel: 'claude-3-5-sonnet-20241022',
    apiKeyRequired: true,
    apiKeyFormat: 'sk-ant-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'google-ai',
    name: 'Google AI (Studio)',
    providerType: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://ai.google.dev',
    websiteUrl: 'https://makersuite.google.com',
    icon: '🔷',
    description: 'Gemini models via Google AI Studio',
    defaultModel: 'gemini-1.5-pro',
    apiKeyRequired: true,
    apiKeyFormat: 'AIza...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'meta-ai',
    name: 'Meta AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.meta.ai',
    docsUrl: 'https://ai.meta.com',
    websiteUrl: 'https://ai.meta.com',
    icon: '🟦',
    description: 'Llama models',
    defaultModel: 'llama-3-70b',
    apiKeyRequired: true,
    apiKeyFormat: 'meta-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs',
    websiteUrl: 'https://openai.com',
    icon: '⚪',
    description: 'GPT models',
    defaultModel: 'gpt-4o',
    apiKeyRequired: true,
    apiKeyFormat: 'sk-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'x-ai',
    name: 'X.AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://docs.x.ai',
    websiteUrl: 'https://x.ai',
    icon: '𝕏',
    description: 'Grok models',
    defaultModel: 'grok-beta',
    apiKeyRequired: true,
    apiKeyFormat: 'xai-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'moonshotai',
    name: 'MoonshotAI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.ai/v1',
    docsUrl: 'https://platform.moonshot.cn/docs',
    websiteUrl: 'https://www.moonshot.cn',
    icon: '🌙',
    description: 'Kimi models',
    defaultModel: 'moonshot-v1-8k',
    apiKeyRequired: true,
    apiKeyFormat: 'sk-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'xiaomi-ai',
    name: 'Xiaomi AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    docsUrl: 'https://ai.xiaomi.com',
    websiteUrl: 'https://ai.xiaomi.com',
    icon: '📱',
    description: 'Xiaomi AI models',
    defaultModel: 'xiaomi-ai-1',
    apiKeyRequired: true,
    apiKeyFormat: 'xai-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'z-ai',
    name: 'Z.AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    docsUrl: 'https://docs.z.ai',
    websiteUrl: 'https://z.ai',
    icon: 'ℤ',
    description: 'Z AI models',
    defaultModel: 'z-ai-1',
    apiKeyRequired: true,
    apiKeyFormat: 'zai-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'z-ai-coding',
    name: 'Z.AI (Coding Plan)',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    docsUrl: 'https://docs.z.ai',
    websiteUrl: 'https://z.ai',
    icon: '💻',
    description: 'Z AI Coding Plan models',
    defaultModel: 'z-ai-coding-1',
    apiKeyRequired: true,
    apiKeyFormat: 'zai-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    docsUrl: 'https://platform.deepseek.com',
    websiteUrl: 'https://www.deepseek.com',
    icon: '🔍',
    description: 'DeepSeek models',
    defaultModel: 'deepseek-chat',
    apiKeyRequired: true,
    apiKeyFormat: 'sk-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'mistral-ai',
    name: 'Mistral AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://docs.mistral.ai',
    websiteUrl: 'https://mistral.ai',
    icon: '🌪️',
    description: 'Mistral models',
    defaultModel: 'mistral-large-latest',
    apiKeyRequired: true,
    apiKeyFormat: 'mistral-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    docsUrl: 'https://docs.perplexity.ai',
    websiteUrl: 'https://www.perplexity.ai',
    icon: '❓',
    description: 'Perplexity AI models',
    defaultModel: 'sonar-small-online',
    apiKeyRequired: true,
    apiKeyFormat: 'pplx-...',
    supportsModelsEndpoint: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.minimax.io/v1',
    docsUrl: 'https://api.minimax.chat/document',
    websiteUrl: 'https://www.minimax.chat',
    icon: '📊',
    description: 'MiniMax AI models',
    defaultModel: 'abab6-chat',
    apiKeyRequired: true,
    apiKeyFormat: 'sk-...',
    supportsModelsEndpoint: true,
  },
];

/**
 * Get an official provider by ID
 */
export function getOfficialProvider(id: string): OfficialProvider | undefined {
  return OFFICIAL_PROVIDERS.find(provider => provider.id === id);
}

/**
 * Convert an official provider to a connection preset
 */
export function officialProviderToConnectionPreset(
  provider: OfficialProvider,
  name?: string
): ConnectionPreset {
  const now = new Date().toISOString();
  return {
    id: `official-${provider.id}`,
    name: name || provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    apiKeyRef: 'local',
    apiKeys: [],
    model: provider.defaultModel || '',
    promptPostProcessing: 'none',
    bypassStatusCheck: !provider.supportsModelsEndpoint,
    extraHeaders: {},
    extraQueryParams: {},
    createdAt: now,
    updatedAt: now,
    ...provider.recommendedSettings,
  };
}