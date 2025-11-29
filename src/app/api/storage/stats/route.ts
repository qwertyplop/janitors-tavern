import { NextResponse } from 'next/server';
import { getStats, getTimeUntilReset } from '@/lib/stats';

// GET /api/storage/stats - Get usage statistics
export async function GET() {
  try {
    const stats = await getStats();
    const timeUntilReset = getTimeUntilReset();

    return NextResponse.json({
      ...stats,
      timeUntilReset,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
