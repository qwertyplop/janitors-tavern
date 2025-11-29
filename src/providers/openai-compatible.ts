import { ChatProvider, ProviderRequest, ProviderConfig } from './base';
import { InternalChatResponse, ChatMessage } from '@/types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider extends ChatProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async sendChatCompletion(request: ProviderRequest): Promise<InternalChatResponse> {
    const startTime = Date.now();

    const openaiRequest: OpenAIRequest = {
      model: request.model || this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
      })),
    };

    // Apply sampler parameters
    if (request.parameters.temperature !== undefined) {
      openaiRequest.temperature = request.parameters.temperature;
    }
    if (request.parameters.topP !== undefined) {
      openaiRequest.top_p = request.parameters.topP;
    }
    if (request.parameters.maxTokens !== undefined) {
      openaiRequest.max_tokens = request.parameters.maxTokens;
    }
    if (request.parameters.presencePenalty !== undefined) {
      openaiRequest.presence_penalty = request.parameters.presencePenalty;
    }
    if (request.parameters.frequencyPenalty !== undefined) {
      openaiRequest.frequency_penalty = request.parameters.frequencyPenalty;
    }
    if (request.parameters.stop) {
      openaiRequest.stop = request.parameters.stop;
    }

    try {
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          message: { role: 'assistant', content: '' },
          error: `Provider error: ${response.status} - ${errorText}`,
        };
      }

      const data: OpenAIResponse = await response.json();
      const duration = Date.now() - startTime;

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.choices[0]?.message?.content || '',
      };

      return {
        message: assistantMessage,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        debug: {
          provider: 'openai-compatible',
          model: data.model,
          requestDuration: duration,
        },
      };
    } catch (error) {
      return {
        message: { role: 'assistant', content: '' },
        error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.buildUrl('/models'), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Connection failed: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
