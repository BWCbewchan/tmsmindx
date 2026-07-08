ALTER TABLE teaching_documents
ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'file';

ALTER TABLE teaching_documents
ADD COLUMN IF NOT EXISTS material_url TEXT;

ALTER TABLE teaching_documents
DROP CONSTRAINT IF EXISTS teaching_documents_source_type_check;

ALTER TABLE teaching_documents
ADD CONSTRAINT teaching_documents_source_type_check
CHECK (source_type IN ('file', 'material_link'));

CREATE INDEX IF NOT EXISTS idx_teaching_documents_source_type
ON teaching_documents(source_type);
