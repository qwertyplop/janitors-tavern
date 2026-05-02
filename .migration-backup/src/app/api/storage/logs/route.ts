import { NextResponse } from 'next/server';
import { getLogs, clearLogs, getLogStats } from '@/lib/logger';

// GET /api/storage/logs - Get all logs
export async function GET() {
  try {
    const [logs, stats] = await Promise.all([
      getLogs(),
      getLogStats(),
    ]);

    return NextResponse.json({
      logs,
      count: stats.count,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    return NextResponse.json(
      { error: 'Failed to get logs', logs: [] },
      { status: 500 }
    );
  }
}

// DELETE /api/storage/logs - Clear all logs
export async function DELETE() {
  try {
    await clearLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
