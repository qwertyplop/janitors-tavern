import { NextRequest, NextResponse } from 'next/server';
import { createProvider, ProviderConfig } from '@/providers';
import { ProviderType } from '@/types';

interface TestConnectionRequest {
  providerType: ProviderType;
  baseUrl: string;
  apiKeyEnvVar?: string;
  apiKey?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestConnectionRequest = await request.json();

    // Get API key from environment variable or directly from request
    let apiKey = body.apiKey || '';
    if (body.apiKeyEnvVar) {
      apiKey = process.env[body.apiKeyEnvVar] || '';
    }

    if (!apiKey && body.providerType !== 'custom-http') {
      return NextResponse.json(
        { success: false, message: 'API key not found' },
        { status: 400 }
      );
    }

    const config: ProviderConfig = {
      baseUrl: body.baseUrl,
      apiKey,
      model: body.model || 'default',
      extraHeaders: body.extraHeaders,
    };

    const provider = createProvider(body.providerType, config);
    const result = await provider.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
