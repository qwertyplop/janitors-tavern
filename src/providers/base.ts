import { ChatMessage, SamplerParameters, InternalChatResponse } from '@/types';

export interface ProviderRequest {
  messages: ChatMessage[];
  model: string;
  parameters: SamplerParameters;
  extraHeaders?: Record<string, string>;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  extraQueryParams?: Record<string, string>;
}

export abstract class ChatProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract sendChatCompletion(request: ProviderRequest): Promise<InternalChatResponse>;

  abstract testConnection(): Promise<{ success: boolean; message: string }>;

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.extraHeaders,
    };
  }

  protected buildUrl(path: string): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const queryParams = this.config.extraQueryParams;

    let url = `${base}${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }
    return url;
  }
}
