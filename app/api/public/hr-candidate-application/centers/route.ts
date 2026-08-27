import pool from '@/lib/db';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limited = await rateLimitOr429Async(
    `public-candidate-centers:${clientIpFromRequest(request)}`,
    30,
    60_000,
  );
  if (limited) return limited;

  try {
    const result = await pool.query(
      `SELECT
         id,
         COALESCE(display_name, full_name) AS name,
         full_name,
         short_code,
         region,
         COALESCE(full_address, address) AS address,
         COALESCE(map_url, map_link) AS map_url
       FROM centers
       WHERE COALESCE(status, 'Active') = 'Active'
       ORDER BY region NULLS LAST, COALESCE(display_name, full_name), full_name`,
    );

    return NextResponse.json({
      success: true,
      centers: result.rows.map((row) => ({
        id: row.id,
        name: row.name || row.full_name || row.short_code || `Cơ sở ${row.id}`,
        address: row.address || '',
        mapUrl: row.map_url || '',
        region: row.region || '',
      })),
    });
  } catch (error) {
    console.error('Public HR candidate centers error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách cơ sở.' },
      { status: 500 },
    );
  }
}
