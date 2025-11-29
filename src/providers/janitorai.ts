import { ChatProvider, ProviderRequest, ProviderConfig } from './base';
import { InternalChatResponse, ChatMessage } from '@/types';

// JanitorAI provider - uses OpenAI-compatible format by default
// but can be customized for JanitorAI-specific endpoints if needed

export class JanitorAIProvider extends ChatProvider {
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

    const requestBody = {
      model: request.model || this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
      })),
      temperature: request.parameters.temperature,
      top_p: request.parameters.topP,
      max_tokens: request.parameters.maxTokens,
      presence_penalty: request.parameters.presencePenalty,
      frequency_penalty: request.parameters.frequencyPenalty,
    };

    // Remove undefined values
    Object.keys(requestBody).forEach((key) => {
      if ((requestBody as Record<string, unknown>)[key] === undefined) {
        delete (requestBody as Record<string, unknown>)[key];
      }
    });

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
          error: `JanitorAI error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || '',
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
          provider: 'janitorai',
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
      // Test by attempting to list models or a simple health check
      const response = await fetch(this.buildUrl('/models'), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        return { success: true, message: 'JanitorAI connection successful' };
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
