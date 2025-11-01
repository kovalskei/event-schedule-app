-- V1__add_v2_columns_2025_11_02.sql
-- Add V2 system columns without ON DELETE clauses
-- Safe for production - only adds columns, no deletions

-- ============================================
-- Extensions (idempotent)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Helper Functions
-- ============================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- New Table: content_plan_items
-- ============================================

CREATE TABLE IF NOT EXISTS content_plan_items (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL,
    sheet_id TEXT NOT NULL,
    row_idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL,
    planned_send_at TIMESTAMP NULL,
    hash_input TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cpi_unique
    ON content_plan_items(event_id, sheet_id, row_idx);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_cpi_updated_at') THEN
        CREATE TRIGGER trg_cpi_updated_at
        BEFORE UPDATE ON content_plan_items
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- ============================================
-- New Table: approvals
-- ============================================

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id BIGINT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'pending',
    actor TEXT NULL,
    reason TEXT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_approvals_updated_at') THEN
        CREATE TRIGGER trg_approvals_updated_at
        BEFORE UPDATE ON approvals
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- ============================================
-- New Table: email_events
-- ============================================

CREATE TABLE IF NOT EXISTS email_events (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT,
    message_id TEXT,
    event_type TEXT NOT NULL,
    event_time TIMESTAMP DEFAULT now(),
    meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_events_email_id ON email_events(email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON email_events(event_type, event_time);

-- ============================================
-- Enhance event_mailing_lists (branding)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='event_mailing_lists' AND column_name='accent_color'
    ) THEN
        ALTER TABLE event_mailing_lists ADD COLUMN accent_color VARCHAR(9) DEFAULT '#BB35E0';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='event_mailing_lists' AND column_name='footer_text'
    ) THEN
        ALTER TABLE event_mailing_lists ADD COLUMN footer_text TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='event_mailing_lists' AND column_name='logo_url_override'
    ) THEN
        ALTER TABLE event_mailing_lists ADD COLUMN logo_url_override TEXT;
    END IF;
END $$;

-- ============================================
-- Enhance generated_emails (V2 tracking)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='content_plan_item_id'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN content_plan_item_id BIGINT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='unisender_message_id'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN unisender_message_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='scheduled_at'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN scheduled_at TIMESTAMP NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='approved_by'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN approved_by TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='approved_at'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN approved_at TIMESTAMP NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='meta'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN meta JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='generated_emails' AND column_name='hash_input'
    ) THEN
        ALTER TABLE generated_emails ADD COLUMN hash_input TEXT;
    END IF;
END $$;

-- Idempotency index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname='uniq_generated_per_plan'
    ) THEN
        CREATE UNIQUE INDEX uniq_generated_per_plan
            ON generated_emails(event_list_id, content_plan_item_id)
            WHERE content_plan_item_id IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- Enhance knowledge_store (embeddings metadata)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='knowledge_store' AND column_name='embedding_model'
    ) THEN
        ALTER TABLE knowledge_store ADD COLUMN embedding_model TEXT DEFAULT 'text-embedding-3-small';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='knowledge_store' AND column_name='embedding_dim'
    ) THEN
        ALTER TABLE knowledge_store ADD COLUMN embedding_dim INT DEFAULT 1536;
    END IF;
END $$;

-- Vector index for similarity search
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname='idx_knowledge_embedding_ivf'
    ) THEN
        CREATE INDEX idx_knowledge_embedding_ivf
            ON knowledge_store
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Skip if extension not available
        RAISE NOTICE 'Skipping vector index: %', SQLERRM;
END $$;

-- ============================================
-- Triggers for updated_at (all tables)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_events_updated_at') THEN
        CREATE TRIGGER trg_events_updated_at
        BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_event_mailing_lists_updated_at') THEN
        CREATE TRIGGER trg_event_mailing_lists_updated_at
        BEFORE UPDATE ON event_mailing_lists
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_email_templates_updated_at') THEN
        CREATE TRIGGER trg_email_templates_updated_at
        BEFORE UPDATE ON email_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_generated_emails_updated_at') THEN
        CREATE TRIGGER trg_generated_emails_updated_at
        BEFORE UPDATE ON generated_emails
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_knowledge_store_updated_at') THEN
        CREATE TRIGGER trg_knowledge_store_updated_at
        BEFORE UPDATE ON knowledge_store
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- ============================================
-- Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_content_plan_items_event_id ON content_plan_items(event_id);
CREATE INDEX IF NOT EXISTS idx_generated_emails_plan_item ON generated_emails(content_plan_item_id);
CREATE INDEX IF NOT EXISTS idx_approvals_email_id ON approvals(email_id);
CREATE INDEX IF NOT EXISTS idx_approvals_token ON approvals(token);
CREATE INDEX IF NOT EXISTS idx_approvals_state ON approvals(state);
