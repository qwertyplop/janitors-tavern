import { NextResponse } from 'next/server';

// Check if Vercel Blob is configured
export async function GET() {
  // Check for BLOB_READ_WRITE_TOKEN environment variable
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return NextResponse.json({
    configured: blobConfigured,
    provider: blobConfigured ? 'blob' : 'local',
  });
}
