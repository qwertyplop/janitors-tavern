import { NextRequest, NextResponse } from 'next/server';
import { getLogs, clearLogs, getLogStats } from '@/lib/logger';

// GET /api/logs - Get log stats (console logs only, no file storage)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const maxEntries = parseInt(searchParams.get('max') || '50', 10);

  try {
    const logs = await getLogs(); // Currently returns empty array as logs are console-only
    const stats = await getLogStats();

    return NextResponse.json({
      logs,
      fileSize: stats.count,
      filePath: 'console-only',
      message: 'Logs are available in the deployment platform logs dashboard',
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read logs: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// DELETE /api/logs - Clear logs (no-op as logs are console-only)
export async function DELETE(request: NextRequest) {
  // No-op as logs are console-only and managed by the platform

  try {
    await clearLogs();
    return NextResponse.json({ success: true, message: 'Console logs are managed by the deployment platform' });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
