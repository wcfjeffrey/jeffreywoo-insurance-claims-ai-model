-- JeffreyWoo Insurance Claims — core schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM (
  'claim_officer',
  'accounting_staff',
  'manager',
  'customer'
);

CREATE TYPE claim_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'escalated',
  'approved',
  'rejected',
  'payment_pending',
  'paid',
  'closed'
);

CREATE TYPE disbursement_status AS ENUM (
  'scheduled',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'sms',
  'teams',
  'slack',
  'in_app'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  department TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_user_time ON audit_log (user_id, created_at DESC);

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES users (id),
  policy_number TEXT NOT NULL,
  incident_date DATE NOT NULL,
  incident_description TEXT NOT NULL,
  claimed_amount NUMERIC(18, 2) NOT NULL,
  approved_amount NUMERIC(18, 2),
  currency TEXT NOT NULL DEFAULT 'HKD',
  status claim_status NOT NULL DEFAULT 'draft',
  workflow_step INT NOT NULL DEFAULT 0,
  escalation_level INT NOT NULL DEFAULT 0,
  fraud_risk_score NUMERIC(5, 2),
  fraud_flags JSONB NOT NULL DEFAULT '[]',
  coverage_status TEXT,
  coverage_notes TEXT,
  assigned_officer_id UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_customer ON claims (customer_id);
CREATE INDEX idx_claims_status ON claims (status);
CREATE INDEX idx_claims_created ON claims (created_at DESC);

CREATE TABLE claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  uploaded_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_events (
  id BIGSERIAL PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  from_status claim_status,
  to_status claim_status NOT NULL,
  actor_id UUID REFERENCES users (id),
  action TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  model_version TEXT,
  score NUMERIC(8, 4),
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims (id) ON DELETE SET NULL,
  ledger_account TEXT NOT NULL,
  debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'HKD',
  external_ref TEXT,
  provider TEXT NOT NULL DEFAULT 'internal',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  gross_amount NUMERIC(18, 2) NOT NULL,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HKD',
  fx_rate NUMERIC(18, 8),
  base_currency TEXT NOT NULL DEFAULT 'HKD',
  status disbursement_status NOT NULL DEFAULT 'scheduled',
  scheduled_for DATE,
  paid_at TIMESTAMPTZ,
  hkma_payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nl_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id),
  natural_language TEXT NOT NULL,
  interpretation JSONB NOT NULL DEFAULT '{}',
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hkma_payment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id UUID NOT NULL REFERENCES disbursements (id) ON DELETE CASCADE,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
