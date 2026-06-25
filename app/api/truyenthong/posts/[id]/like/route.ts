import { requireCommunicationActor } from '@/lib/communication-actor';
import pool from '@/lib/db';
import { findCommunicationPostByIdentifier } from '@/lib/truyenthong-posts';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_REACTIONS = new Set(['like', 'love', 'haha', 'sad', 'angry']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const actor = await requireCommunicationActor(request);
    if (!actor.ok) return actor.response;

    const body = await request.json().catch(() => ({}));
    const requestedReaction = typeof body?.reaction === 'string' ? body.reaction : 'like';
    if (!ALLOWED_REACTIONS.has(requestedReaction)) {
      return NextResponse.json({ error: 'Reaction is invalid' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const lookup = await findCommunicationPostByIdentifier(client, id, {
        summary: true,
      });
      if (lookup.invalid) {
        return NextResponse.json({ error: 'Post identifier is invalid' }, { status: 400 });
      }
      if (!lookup.post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const post = lookup.post;
      if (post.status !== 'published' && !actor.isAdmin) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      await client.query('BEGIN');

      const existingLike = await client.query(
        'SELECT id, reaction FROM communication_likes WHERE post_id = $1 AND user_id = $2',
        [post.id, actor.userId],
      );

      let isLiked = false;
      let savedReaction: string | null = null;
      let action = '';

      if (existingLike.rows.length > 0) {
        const existingReaction = existingLike.rows[0].reaction;
        if (existingReaction === requestedReaction) {
          await client.query(
            'DELETE FROM communication_likes WHERE post_id = $1 AND user_id = $2',
            [post.id, actor.userId],
          );
          await client.query(
            'UPDATE communications SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1',
            [post.id],
          );
          action = 'unliked';
        } else {
          await client.query(
            'UPDATE communication_likes SET reaction = $1, user_name = $2 WHERE post_id = $3 AND user_id = $4',
            [requestedReaction, actor.userName, post.id, actor.userId],
          );
          isLiked = true;
          savedReaction = requestedReaction;
          action = 'reacted';
        }
      } else {
        await client.query(
          'INSERT INTO communication_likes (post_id, user_id, reaction, user_name) VALUES ($1, $2, $3, $4)',
          [post.id, actor.userId, requestedReaction, actor.userName],
        );
        await client.query(
          'UPDATE communications SET like_count = like_count + 1 WHERE id = $1',
          [post.id],
        );
        isLiked = true;
        savedReaction = requestedReaction;
        action = 'liked';
      }

      await client.query('COMMIT');

      const result = await client.query('SELECT like_count FROM communications WHERE id = $1', [
        post.id,
      ]);
      const reactionCountsResult = await client.query(
        `SELECT reaction, COUNT(*) as count
         FROM communication_likes
         WHERE post_id = $1 AND reaction IS NOT NULL
         GROUP BY reaction ORDER BY count DESC`,
        [post.id],
      );
      const reaction_counts: Record<string, number> = {};
      reactionCountsResult.rows.forEach((row: any) => {
        reaction_counts[row.reaction] = Number.parseInt(row.count, 10);
      });

      return NextResponse.json({
        like_count: result.rows[0]?.like_count ?? 0,
        isLiked,
        reaction: savedReaction,
        reaction_counts,
        action,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Error toggling like:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing like request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
