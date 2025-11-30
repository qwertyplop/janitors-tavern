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
  stream: boolean;
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

// Streaming chunk interface
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamingResult {
  stream: ReadableStream<Uint8Array>;
  model: string;
  requestId: string;
}

export class OpenAICompatibleProvider extends ChatProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getHeaders(): Record<string, string> {
    // Clean headers - don't pass through any identifying info from JanitorAI
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Accept': 'text/event-stream',
      'User-Agent': 'JanitorsTavern/1.0',
      // Add custom headers from config (user can override)
      ...this.config.extraHeaders,
    };
  }

  protected getNonStreamHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Accept': 'application/json',
      'User-Agent': 'JanitorsTavern/1.0',
      ...this.config.extraHeaders,
    };
  }

  private buildOpenAIRequest(request: ProviderRequest, stream: boolean): OpenAIRequest {
    const openaiRequest: OpenAIRequest = {
      model: request.model || this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
      })),
      stream,
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

    return openaiRequest;
  }

  async sendChatCompletion(request: ProviderRequest): Promise<InternalChatResponse> {
    const startTime = Date.now();
    const openaiRequest = this.buildOpenAIRequest(request, false);

    try {
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getNonStreamHeaders(),
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

  /**
   * Send a non-streaming request and return raw response for passthrough
   * This is like the Python proxy - just forward the response as-is
   */
  async sendChatCompletionRaw(
    request: ProviderRequest
  ): Promise<{ body: string; status: number; headers: Headers; error?: string }> {
    const openaiRequest = this.buildOpenAIRequest(request, false);

    try {
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getNonStreamHeaders(),
        body: JSON.stringify(openaiRequest),
      });

      const body = await response.text();

      return {
        body,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return {
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        status: 500,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a streaming chat completion request
   * Returns the raw ReadableStream from the provider - pure passthrough like Python proxy
   */
  async sendChatCompletionStream(
    request: ProviderRequest
  ): Promise<{ stream: ReadableStream<Uint8Array>; error?: string; status: number; headers: Headers }> {
    const openaiRequest = this.buildOpenAIRequest(request, true);

    try {
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          stream: new ReadableStream(),
          error: `Provider error: ${response.status} - ${errorText}`,
          status: response.status,
          headers: response.headers,
        };
      }

      if (!response.body) {
        return {
          stream: new ReadableStream(),
          error: 'No response body',
          status: 500,
          headers: new Headers(),
        };
      }

      // Pure passthrough - no transformation, just like Python proxy
      return {
        stream: response.body,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      return {
        stream: new ReadableStream(),
        error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500,
        headers: new Headers(),
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.buildUrl('/models'), {
        method: 'GET',
        headers: this.getNonStreamHeaders(),
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
