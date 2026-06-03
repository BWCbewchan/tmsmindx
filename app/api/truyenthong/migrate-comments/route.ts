import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server'
import fs from 'fs'
import path from 'path'

// API to run migration for comments tables
export async function GET(request: NextRequest) {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;
    return runMigration()
}

export async function POST(request: NextRequest) {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;
    return runMigration()
}

async function runMigration() {
    try {
        // Read the SQL file
        const sqlPath = path.join(process.cwd(), 'scripts', 'create_truyenthong_comments_tables.sql')
        const sqlContent = fs.readFileSync(sqlPath, 'utf8')

        // Execute the SQL
        await pool.query(sqlContent)

        return NextResponse.json({
            success: true,
            message: 'Comments tables created successfully! You can now use the comments feature.'
        })
    } catch (error: any) {
        console.error('Error running migration:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Failed to create tables',
                details: error.message 
            },
            { status: 500 }
        )
    }
}
