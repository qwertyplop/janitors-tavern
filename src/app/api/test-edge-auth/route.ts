import { NextResponse } from 'next/server';
import { testEdgeAuth } from '@/lib/test-edge-auth';

// This route can run in edge runtime
export const runtime = 'edge';

export async function GET() {
  try {
    const testResult = await testEdgeAuth();

    if (testResult) {
      return NextResponse.json({
        success: true,
        message: 'Edge Runtime compatibility test passed',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Edge Runtime compatibility test failed',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Edge Runtime compatibility test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}