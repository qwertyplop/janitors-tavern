import { NextRequest, NextResponse } from 'next/server';
import { getServerSettings } from '@/lib/server-storage';

interface ModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
  display_name?: string;
  type?: string;
  created_at?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get settings for logging
    const settings = await getServerSettings();
    const shouldLogRawRequestBody = () => settings.logging?.logRawRequestBody;
    
    // Read raw request body for logging
    const rawBodyText = await request.text();
    
    // Log raw request body if enabled
    if (shouldLogRawRequestBody()) {
      console.log('[Models Proxy] RAW REQUEST BODY:', rawBodyText);
    }
    
    // Parse the JSON body
    const body = JSON.parse(rawBodyText);
    const { baseUrl, apiKey } = body;

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    // Check if this is an Anthropic provider
    const isAnthropic = baseUrl.toLowerCase().includes('anthropic.com');

    // Normalize the base URL
    let normalizedUrl = baseUrl.replace(/\/+$/, '');
    normalizedUrl = normalizedUrl.replace(/\/v1$/i, '');
    const modelsUrl = `${normalizedUrl}/v1/models`;

    console.log('[Models Proxy] Fetching from:', modelsUrl, 'isAnthropic:', isAnthropic);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      if (isAnthropic) {
        // Anthropic uses X-Api-Key header instead of Authorization: Bearer
        headers['X-Api-Key'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    // Add Anthropic version header if this is an Anthropic provider
    if (isAnthropic) {
      headers['anthropic-version'] = '2023-06-01';
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
    } else if (isAnthropic && data.data && Array.isArray(data.data)) {
      // Anthropic format: { data: [{ id, display_name, type, created_at }], first_id, has_more, last_id }
      models = data.data.map((item: any) => ({
        id: item.id,
        display_name: item.display_name,
        type: item.type,
        created_at: item.created_at,
      }));
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
