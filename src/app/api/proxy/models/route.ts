import { NextRequest, NextResponse } from 'next/server';

interface ModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey } = body;

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    // Normalize the base URL
    let normalizedUrl = baseUrl.replace(/\/+$/, '');
    normalizedUrl = normalizedUrl.replace(/\/v1$/i, '');
    const modelsUrl = `${normalizedUrl}/v1/models`;

    console.log('[Models Proxy] Fetching from:', modelsUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Models Proxy] Error response:', response.status, errorText);
      return NextResponse.json(
        { error: `Provider returned ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Models Proxy] Response received');

    // Normalize different response formats
    let models: ModelInfo[] = [];

    if (Array.isArray(data)) {
      // Some APIs return array directly
      models = data.map((m: string | ModelInfo) =>
        typeof m === 'string' ? { id: m } : m
      );
    } else if (data.data && Array.isArray(data.data)) {
      // OpenAI format: { data: [...] }
      models = data.data;
    } else if (data.models && Array.isArray(data.models)) {
      // Some APIs use { models: [...] }
      models = data.models;
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[Models Proxy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
