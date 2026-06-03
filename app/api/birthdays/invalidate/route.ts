import { NextRequest, NextResponse } from 'next/server'
import { invalidateCurrentAndNeighboringMonths } from '@/lib/birthday-cache'
import { requireSameOriginMutation } from '@/lib/api-security'
import { requireBearerSession } from '@/lib/datasource-api-auth'

export const dynamic = 'force-dynamic'

// POST: Force invalidate birthdays cache (được call từ privacy setting change)
export async function POST(request: NextRequest) {
    try {
        const originDenied = requireSameOriginMutation(request)
        if (originDenied) return originDenied
        const auth = await requireBearerSession(request)
        if (!auth.ok) return auth.response

        invalidateCurrentAndNeighboringMonths()

        return NextResponse.json({
            success: true,
            message: 'Birthdays cache invalidated successfully'
        })
    } catch (error) {
        console.error('Error invalidating cache:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to invalidate cache' },
            { status: 500 }
        )
    }
}
