ALTER TABLE hr_candidate_training_records
ADD COLUMN IF NOT EXISTS absence_note TEXT;
