CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  sender_email VARCHAR(255),
  to_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cc_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  subject TEXT NOT NULL DEFAULT '',
  email_type VARCHAR(120) NOT NULL DEFAULT 'unknown',
  source VARCHAR(255) NOT NULL DEFAULT 'unknown',
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  provider_message_id VARCHAR(500),
  smtp_response TEXT,
  error_code VARCHAR(100),
  error_category VARCHAR(50),
  error_message TEXT,
  response_code INTEGER,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at
  ON email_delivery_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status_created_at
  ON email_delivery_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_error_category_created_at
  ON email_delivery_logs(error_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email_type_created_at
  ON email_delivery_logs(email_type, created_at DESC);

CREATE TABLE IF NOT EXISTS email_monitor_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_message_limit INTEGER NOT NULL DEFAULT 2000 CHECK (daily_message_limit > 0),
  daily_recipient_limit INTEGER NOT NULL DEFAULT 10000 CHECK (daily_recipient_limit > 0),
  warning_threshold_percent NUMERIC(5, 2) NOT NULL DEFAULT 80
    CHECK (warning_threshold_percent > 0 AND warning_threshold_percent <= 100),
  latency_warning_ms INTEGER NOT NULL DEFAULT 5000 CHECK (latency_warning_ms > 0),
  failure_rate_warning_percent NUMERIC(5, 2) NOT NULL DEFAULT 5
    CHECK (failure_rate_warning_percent > 0 AND failure_rate_warning_percent <= 100),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 730),
  updated_by_email VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO email_monitor_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;