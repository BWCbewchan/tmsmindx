ALTER TABLE training_video_assignments
ADD COLUMN IF NOT EXISTS assignment_context VARCHAR(50) NOT NULL DEFAULT 'advanced_training',
ADD COLUMN IF NOT EXISTS training_stage VARCHAR(50) NOT NULL DEFAULT 'advanced_video',
ADD COLUMN IF NOT EXISTS target_ref VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_training_video_assignments_context
  ON training_video_assignments(assignment_context);

CREATE INDEX IF NOT EXISTS idx_training_video_assignments_stage
  ON training_video_assignments(assignment_context, training_stage, target_ref);
