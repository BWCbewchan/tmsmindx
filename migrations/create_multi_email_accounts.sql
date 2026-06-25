CREATE TABLE IF NOT EXISTS email_sender_accounts (
  id BIGSERIAL PRIMARY KEY,
  account_key VARCHAR(120) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL DEFAULT 'TPS Teaching',
  source VARCHAR(20) NOT NULL CHECK (source IN ('env', 'database')),
  encrypted_app_password TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  daily_to_limit INTEGER NOT NULL DEFAULT 2000 CHECK (daily_to_limit > 0),
  daily_cc_limit INTEGER NOT NULL DEFAULT 2000 CHECK (daily_cc_limit > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_selected_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  last_verify_ok BOOLEAN,
  last_verify_error TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_sender_accounts_email
  ON email_sender_accounts (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_email_sender_accounts_active_order
  ON email_sender_accounts (is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS email_sender_routing_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_account_id BIGINT REFERENCES email_sender_accounts(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO email_sender_routing_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE email_delivery_logs
  ADD COLUMN IF NOT EXISTS sender_account_id BIGINT
    REFERENCES email_sender_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_recipient_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_recipient_count INTEGER NOT NULL DEFAULT 0;

UPDATE email_delivery_logs
SET
  to_recipient_count = COALESCE(array_length(to_recipients, 1), 0),
  cc_recipient_count = COALESCE(array_length(cc_recipients, 1), 0)
WHERE to_recipient_count = 0
  AND cc_recipient_count = 0;

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_sender_created_at
  ON email_delivery_logs(sender_account_id, created_at DESC);

ALTER TABLE email_monitor_settings
  ADD COLUMN IF NOT EXISTS default_to_limit INTEGER NOT NULL DEFAULT 2000
    CHECK (default_to_limit > 0),
  ADD COLUMN IF NOT EXISTS default_cc_limit INTEGER NOT NULL DEFAULT 2000
    CHECK (default_cc_limit > 0);
