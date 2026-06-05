import { requireBearerAdminOrSuper } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const gate = await requireBearerAdminOrSuper(request);
  if (!gate.ok) return gate.response;

  let client;
  
  try {
    // Lấy connection từ pool
    client = await pool.connect();
    
    // Test connection
    const testQuery = await client.query('SELECT NOW()');
    console.log('Database connected at:', testQuery.rows[0]);
    
    // Query data từ bảng teachers
    const result = await client.query(`
      SELECT code, full_name, user_name, work_email, main_centre, course_line, status
      FROM teachers
      ORDER BY full_name ASC NULLS LAST
      LIMIT 500
    `);
    
    return NextResponse.json({
      success: true,
      message: 'Kết nối thành công!',
      count: result.rowCount,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Database error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
    
  } finally {
    // Release connection về pool
    if (client) {
      client.release();
    }
  }
}
