CREATE TABLE IF NOT EXISTS quan_ly_qc (
  id BIGSERIAL PRIMARY KEY,
  template_key VARCHAR(80) NOT NULL,
  template_title VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255),
  class_lms_id VARCHAR(120) NOT NULL,
  class_code VARCHAR(255),
  class_name VARCHAR(500) NOT NULL,
  center_lms_id VARCHAR(120),
  center_name VARCHAR(255) NOT NULL,
  teacher_name VARCHAR(500),
  teacher_lms_id VARCHAR(120),
  teacher_username VARCHAR(255),
  teacher_code VARCHAR(120),
  teacher_email VARCHAR(255),
  teacher_rank VARCHAR(100),
  assistant_name VARCHAR(255),
  student_count INTEGER NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  session_lms_id VARCHAR(120),
  session_index INTEGER,
  session_date TIMESTAMP WITH TIME ZONE,
  session_start_time TIMESTAMP WITH TIME ZONE,
  session_end_time TIMESTAMP WITH TIME ZONE,
  course_name VARCHAR(255),
  course_line_name VARCHAR(255),
  criteria_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  raw_total_score NUMERIC(8,2),
  raw_max_score NUMERIC(8,2),
  result_label VARCHAR(50),
  general_note TEXT,
  class_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed BOOLEAN NOT NULL DEFAULT FALSE,
  signed_by_email VARCHAR(255),
  signed_at TIMESTAMP WITH TIME ZONE,
  created_by_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quan_ly_qc_created_at
  ON quan_ly_qc(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quan_ly_qc_created_by
  ON quan_ly_qc(LOWER(created_by_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quan_ly_qc_class_lms
  ON quan_ly_qc(class_lms_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quan_ly_qc_center
  ON quan_ly_qc(LOWER(center_name), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quan_ly_qc_template
  ON quan_ly_qc(template_key, created_at DESC);

DROP TRIGGER IF EXISTS trg_quan_ly_qc_updated_at
  ON quan_ly_qc;
CREATE TRIGGER trg_quan_ly_qc_updated_at
BEFORE UPDATE ON quan_ly_qc
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO app_screens (route_path, label, group_name, sort_order, description, is_active)
VALUES (
  '/admin/quan-ly-qc',
  'Quản Lý Kiểm Tra Chất Lượng',
  'Quản lý Giáo viên & Vận hành',
  24,
  'Tạo và lưu phiếu QC lớp học/giáo viên theo mẫu Google Sheet',
  true
)
ON CONFLICT (route_path) DO UPDATE SET
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO app_permissions (user_id, route_path, can_access)
SELECT u.id, '/admin/quan-ly-qc', true
FROM app_users u
WHERE u.role IN ('super_admin', 'admin', 'manager')
ON CONFLICT (user_id, route_path) DO UPDATE SET can_access = true;

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
    INSERT INTO role_permissions (role_code, route_path)
    SELECT r.role_code, '/admin/quan-ly-qc'
    FROM roles r
    WHERE r.role_code IN ('AD', 'TM', 'TC', 'TE', 'LEAD')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
