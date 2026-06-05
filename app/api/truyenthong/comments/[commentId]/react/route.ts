import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireCommunicationActor } from '@/lib/communication-actor';

const ALLOWED_REACTIONS = new Set(['like', 'love', 'haha', 'sad', 'angry']);

/**
 * Toggle reaction on a comment
 * POST /api/truyenthong/comments/[commentId]/react
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ commentId: string }> }
) {
    try {
        const { commentId } = await params;
        const actor = await requireCommunicationActor(request);
        if (!actor.ok) return actor.response;

        const body = await request.json();
        const { reactionType } = body;

        if (!reactionType || !ALLOWED_REACTIONS.has(reactionType)) {
            return NextResponse.json({ 
                error: 'Invalid reactionType' 
            }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if user already reacted
            const existingReaction = await client.query(
                'SELECT * FROM truyenthong_comment_reactions WHERE comment_id = $1 AND user_id = $2',
                [commentId, actor.userId]
            );

            if (existingReaction.rows.length > 0) {
                const existing = existingReaction.rows[0];
                
                if (existing.reaction_type === reactionType) {
                    // Remove reaction if same type
                    await client.query(
                        'DELETE FROM truyenthong_comment_reactions WHERE comment_id = $1 AND user_id = $2',
                        [commentId, actor.userId]
                    );
                } else {
                    // Update to new reaction type
                    await client.query(
                        'UPDATE truyenthong_comment_reactions SET reaction_type = $1 WHERE comment_id = $2 AND user_id = $3',
                        [reactionType, commentId, actor.userId]
                    );
                }
            } else {
                // Add new reaction
                await client.query(
                    'INSERT INTO truyenthong_comment_reactions (comment_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                    [commentId, actor.userId, reactionType]
                );
            }

            await client.query('COMMIT');

            // Get updated reactions
            const reactions = await client.query(
                `SELECT reaction_type, COUNT(*) as count
                 FROM truyenthong_comment_reactions
                 WHERE comment_id = $1
                 GROUP BY reaction_type`,
                [commentId]
            );

            return NextResponse.json({
                success: true,
                reactions: reactions.rows
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error toggling reaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
