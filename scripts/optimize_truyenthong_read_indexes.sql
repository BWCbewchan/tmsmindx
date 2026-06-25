CREATE INDEX IF NOT EXISTS idx_communications_status_created
ON communications(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_communications_status_views
ON communications(status, view_count DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_communications_related_posts
ON communications(post_type, status, created_at DESC, id DESC);
