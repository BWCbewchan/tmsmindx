import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            // Đảm bảo bảng tồn tại trước khi query
            await client.query(`
                CREATE TABLE IF NOT EXISTS teacher_monthly_honors (
                    id SERIAL PRIMARY KEY,
                    stt INTEGER,
                    full_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    khoi_day VARCHAR(100),
                    co_so VARCHAR(255),
                    thang VARCHAR(20) NOT NULL,
                    so_case INTEGER DEFAULT 0,
                    so_hoc_sinh INTEGER DEFAULT 0,
                    ti_le NUMERIC(5,2) DEFAULT 0,
                    loai VARCHAR(100),
                    thuong_cr NUMERIC(15,2) DEFAULT 0,
                    avatar_url TEXT,
                    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    imported_by VARCHAR(255),
                    UNIQUE(email, thang)
                )
            `)

            // Lấy tháng mới nhất có dữ liệu vinh danh
            const monthRes = await client.query(`
                SELECT thang FROM teacher_monthly_honors
                ORDER BY imported_at DESC LIMIT 1
            `);

            if (monthRes.rows.length > 0) {
                const latestMonth = monthRes.rows[0].thang;
                const result = await client.query(`
                    SELECT
                        COALESCE(email, id::text) AS teacher_code,
                        full_name,
                        COALESCE(co_so, 'MindX') AS center,
                        CAST(ti_le AS FLOAT) AS total_score,
                        avatar_url,
                        slogan
                    FROM teacher_monthly_honors
                    WHERE thang = $1
                    ORDER BY stt ASC NULLS LAST, ti_le DESC
                    LIMIT 3
                `, [latestMonth]);

                return NextResponse.json({
                    success: true,
                    data: result.rows,
                    month: latestMonth,
                });
            }

            // Fallback: lấy từ bảng teachers nếu chưa có honors
            const result = await client.query(`
                SELECT
                    code AS teacher_code,
                    full_name,
                    COALESCE(main_centre, 'MindX') AS center,
                    9.5 AS total_score,
                    ta.avatar_url
                FROM teachers t
                LEFT JOIN teacher_avatars ta ON LOWER(t.work_email) = LOWER(ta.teacher_email)
                WHERE t.status = 'Active'
                ORDER BY full_name ASC NULLS LAST
                LIMIT 3
            `);

            return NextResponse.json({
                success: true,
                data: result.rows,
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching top teachers:', error);
        return NextResponse.json({
            success: true,
            data: [
                { teacher_code: 't1', full_name: 'Nguyễn Văn A', center: 'MindX - Online', total_score: 9.8, avatar_url: null },
                { teacher_code: 't2', full_name: 'Trần Thị B', center: 'MindX HQ', total_score: 9.2, avatar_url: null },
                { teacher_code: 't3', full_name: 'Lê Văn C', center: 'MindX - Hà Nội', total_score: 8.9, avatar_url: null },
            ],
        });
    }
}
