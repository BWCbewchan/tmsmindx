export type TrainingDocumentStage = 'centralized_training' | 'pedagogy_training'
export type TrainingDocumentStatus = 'draft' | 'active'

export type TrainingDocumentRow = {
  id: number
  title: string
  description: string | null
  document_url: string
  stage: TrainingDocumentStage
  session_number: number | null
  sort_order: number
  status: TrainingDocumentStatus
  created_at: string
  updated_at: string
}

export const TRAINING_DOCUMENT_STAGES: Record<TrainingDocumentStage, string> = {
  centralized_training: 'Đào tạo tập trung',
  pedagogy_training: 'Tập huấn sư phạm',
}

export async function ensureTrainingDocumentsTable(pool: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_training_documents (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      document_url TEXT NOT NULL,
      stage VARCHAR(40) NOT NULL DEFAULT 'centralized_training'
        CHECK (stage IN ('centralized_training', 'pedagogy_training')),
      session_number INTEGER CHECK (session_number IS NULL OR session_number > 0),
      sort_order INTEGER NOT NULL DEFAULT 100,
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active')),
      created_by_email VARCHAR(255),
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_hr_training_documents_stage_status_order
      ON hr_training_documents(stage, status, session_number NULLS LAST, sort_order, created_at DESC);

    DROP TRIGGER IF EXISTS trg_hr_training_documents_updated_at
      ON hr_training_documents;
    CREATE TRIGGER trg_hr_training_documents_updated_at
    BEFORE UPDATE ON hr_training_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `)
}

export function normalizeTrainingDocumentStage(value: unknown): TrainingDocumentStage {
  return value === 'pedagogy_training' ? 'pedagogy_training' : 'centralized_training'
}

export function normalizeTrainingDocumentStatus(value: unknown): TrainingDocumentStatus {
  return value === 'active' ? 'active' : 'draft'
}
