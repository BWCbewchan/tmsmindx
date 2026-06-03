import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireCommunicationActor } from '@/lib/communication-actor'

// Edit comment
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ commentId: string }> }
) {
    try {
        const { commentId } = await params
        const actor = await requireCommunicationActor(request)
        if (!actor.ok) return actor.response

        const { content } = await request.json()

        if (!content?.trim()) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Verify ownership before updating
        const result = await pool.query(
            `UPDATE truyenthong_comments 
             SET content = $1, updated_at = NOW() 
             WHERE id = $2 AND user_id = $3
             RETURNING 
                id, content,
                to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at`,
            [content.trim(), commentId, actor.userId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
        }

        return NextResponse.json({ 
            success: true, 
            comment: result.rows[0]
        })
    } catch (error) {
        console.error('Edit comment error:', error)
        return NextResponse.json({ 
            error: 'Failed to edit comment',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// Delete comment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ commentId: string }> }
) {
    try {
        const { commentId } = await params
        const actor = await requireCommunicationActor(request)
        if (!actor.ok) return actor.response
        
        let result
        if (actor.isAdmin) {
            // Admin can delete any comment from truyenthong_comments
            result = await pool.query(
                `DELETE FROM truyenthong_comments WHERE id = $1 RETURNING id`,
                [commentId]
            )
        } else {
            // Regular user can only delete their own comments
            result = await pool.query(
                `DELETE FROM truyenthong_comments WHERE id = $1 AND user_id = $2 RETURNING id`,
                [commentId, actor.userId]
            )
        }

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete comment error:', error)
        return NextResponse.json({ 
            error: 'Failed to delete comment',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

// Toggle hide/show comment (Admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ commentId: string }> }
) {
    try {
        const { commentId } = await params
        const actor = await requireCommunicationActor(request)
        if (!actor.ok) return actor.response
        if (!actor.isAdmin) {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
        }

        const body = await request.json()
        const hiddenRaw = body?.hidden

        const hiddenFlag = hiddenRaw === true || hiddenRaw === 'true'

        const result = await pool.query(
            `UPDATE truyenthong_comments 
             SET hidden = $1 
             WHERE id = $2
             RETURNING id, hidden`,
            [hiddenFlag, commentId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        return NextResponse.json({ 
            success: true, 
            comment: result.rows[0]
        })
    } catch (error) {
        console.error('Toggle hide comment error:', error)
        return NextResponse.json({ 
            error: 'Failed to toggle hide comment',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
