-- Add event_list_id to generated_emails for direct link to mailing list
ALTER TABLE generated_emails ADD COLUMN IF NOT EXISTS event_list_id INTEGER REFERENCES event_mailing_lists(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_emails_event_list_id ON generated_emails(event_list_id);

-- Add status field to track draft/sent/scheduled states
ALTER TABLE generated_emails ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Update existing records to link via campaigns
UPDATE generated_emails ge
SET event_list_id = c.event_list_id
FROM campaigns c
WHERE ge.campaign_id = c.id AND ge.event_list_id IS NULL;