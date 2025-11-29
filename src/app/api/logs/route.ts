import { NextRequest, NextResponse } from 'next/server';
import { readRecentLogs, clearLogs, getLogFileSize } from '@/lib/logger';

// GET /api/logs - Read recent logs
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path') || 'logs/proxy.log';
  const maxEntries = parseInt(searchParams.get('max') || '50', 10);

  try {
    const logs = await readRecentLogs(filePath, maxEntries);
    const size = await getLogFileSize(filePath);

    return NextResponse.json({
      logs,
      fileSize: size,
      filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read logs: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// DELETE /api/logs - Clear log file
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path') || 'logs/proxy.log';

  try {
    await clearLogs(filePath);
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
