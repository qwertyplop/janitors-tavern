import { ChatProvider, ProviderRequest, ProviderConfig } from './base';
import { InternalChatResponse, ChatMessage } from '@/types';

export class CustomHTTPProvider extends ChatProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  protected getHeaders(): Record<string, string> {
    const headers = super.getHeaders();
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async sendChatCompletion(request: ProviderRequest): Promise<InternalChatResponse> {
    const startTime = Date.now();

    // Build a generic request body that can work with various APIs
    const requestBody = {
      model: request.model || this.config.model,
      messages: request.messages,
      ...request.parameters,
    };

    try {
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          message: { role: 'assistant', content: '' },
          error: `Provider error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Try to extract the assistant message from various response formats
      let content = '';
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      } else if (data.message?.content) {
        content = data.message.content;
      } else if (data.content) {
        content = data.content;
      } else if (typeof data.response === 'string') {
        content = data.response;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
      };

      return {
        message: assistantMessage,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || data.usage.promptTokens,
              completionTokens: data.usage.completion_tokens || data.usage.completionTokens,
              totalTokens: data.usage.total_tokens || data.usage.totalTokens,
            }
          : undefined,
        debug: {
          provider: 'custom-http',
          model: data.model || this.config.model,
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
      // First try to send a test message to validate the API key works for chat completions
      const requestBody = {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        max_tokens: 10, // Limit tokens for quick test
      };
      
      const response = await fetch(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        // Check if we got a valid response
        if (data.choices || data.message || data.content || data.response) {
          return { success: true, message: 'Connection successful - API key validated' };
        } else {
          return { success: false, message: 'Connection failed: Invalid response format' };
        }
      } else {
        // If POST fails, fall back to checking if server is reachable
        const headResponse = await fetch(this.config.baseUrl, {
          method: 'HEAD',
          headers: this.getHeaders(),
        });

        // Even a 404 means the server is reachable
        if (headResponse.ok || headResponse.status === 404 || headResponse.status === 405) {
          return { success: true, message: 'Server is reachable (chat endpoint may require different configuration)' };
        } else {
          const errorText = await response.text();
          return { success: false, message: `Connection failed: ${response.status} - ${errorText}` };
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
