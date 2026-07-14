ALTER TABLE teaching_documents
ADD COLUMN IF NOT EXISTS folder_name VARCHAR(50);

UPDATE teaching_documents
SET folder_name = 'Material'
WHERE folder_name IS NULL OR BTRIM(folder_name) = '';

ALTER TABLE teaching_documents
ALTER COLUMN folder_name SET DEFAULT 'Material';

ALTER TABLE teaching_documents
ALTER COLUMN folder_name SET NOT NULL;

ALTER TABLE teaching_documents
DROP CONSTRAINT IF EXISTS teaching_documents_folder_name_check;

ALTER TABLE teaching_documents
ADD CONSTRAINT teaching_documents_folder_name_check
CHECK (
  folder_name IN (
    'Lesson Plan',
    'Slide',
    'Homework',
    'Assigment Barem',
    'Sample',
    'Material'
  )
);

CREATE INDEX IF NOT EXISTS idx_teaching_documents_folder_name
ON teaching_documents(subject_name, course_name, folder_name);
