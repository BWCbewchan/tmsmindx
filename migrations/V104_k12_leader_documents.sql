-- V104: Tạo bảng tài liệu nội bộ K12 Quy Trình, Quy Định Leader/TE/TC
CREATE TABLE IF NOT EXISTS k12_leader_documents (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(400) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  relative_path VARCHAR(600) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  topic VARCHAR(255),
  excerpt TEXT,
  cover_image_url TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'article' CHECK (type IN ('section', 'article')),
  section_id INTEGER,
  parent_id INTEGER,
  content_format VARCHAR(20) NOT NULL DEFAULT 'html' CHECK (content_format IN ('html', 'json')),
  created_by_email VARCHAR(255),
  updated_by_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_status ON k12_leader_documents(status);
CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_sort_order ON k12_leader_documents(sort_order);
CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_type ON k12_leader_documents(type);
CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_section_id ON k12_leader_documents(section_id);
CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_parent_id ON k12_leader_documents(parent_id);

CREATE TABLE IF NOT EXISTS k12_leader_publish_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_data JSONB NOT NULL,
  document_count INTEGER NOT NULL DEFAULT 0,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_k12_leader_publish_snapshots_created_at 
  ON k12_leader_publish_snapshots(created_at DESC);
