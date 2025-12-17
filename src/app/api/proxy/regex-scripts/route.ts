/**
 * Regex Scripts API Endpoint
 * Handles importing, exporting, and managing regex scripts for chat history processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { importRegexScriptsFromJson, exportRegexScriptsToJson, RegexScriptCollection } from '@/lib/regex-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'import':
        return handleImport(body);

      case 'export':
        return handleExport(body);

      case 'validate':
        return handleValidate(body);

      default:
        return new NextResponse(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
    }
  } catch (error) {
    console.error('Regex scripts API error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

async function handleImport(body: any) {
  if (!body.jsonContent) {
    return new NextResponse(JSON.stringify({ error: 'jsonContent is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const collection = await importRegexScriptsFromJson(body.jsonContent);
    return new NextResponse(JSON.stringify({
      success: true,
      collection,
      scriptCount: collection.scripts.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return new NextResponse(JSON.stringify({
      error: 'Failed to parse regex scripts JSON',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

function handleExport(body: any) {
  try {
    const collection: RegexScriptCollection = body.collection || { scripts: [] };
    const jsonContent = exportRegexScriptsToJson(collection);

    return new NextResponse(JSON.stringify({
      success: true,
      jsonContent,
      scriptCount: collection.scripts.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return new NextResponse(JSON.stringify({
      error: 'Failed to export regex scripts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

function handleValidate(body: any) {
  if (!body.jsonContent) {
    return new NextResponse(JSON.stringify({ error: 'jsonContent is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Try to parse the JSON
    const parsed = JSON.parse(body.jsonContent);

    // Validate basic structure
    if (!parsed.scripts || !Array.isArray(parsed.scripts)) {
      return new NextResponse(JSON.stringify({
        error: 'Invalid regex scripts format: scripts array is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Validate each script
    const validationResults = parsed.scripts.map((script: any, index: number) => {
      const errors: string[] = [];

      if (!script.pattern) {
        errors.push('pattern is required');
      } else {
        try {
          new RegExp(script.pattern, script.flags);
        } catch (error) {
          errors.push(`invalid regex pattern: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }

      if (!script.replacement) {
        errors.push('replacement is required');
      }

      return {
        scriptIndex: index,
        scriptName: script.name || `script-${index}`,
        isValid: errors.length === 0,
        errors
      };
    });

    const isValid = validationResults.every((r: any) => r.isValid);

    return new NextResponse(JSON.stringify({
      success: true,
      isValid,
      scriptCount: parsed.scripts.length,
      validationResults
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return new NextResponse(JSON.stringify({
      error: 'Invalid JSON format',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}