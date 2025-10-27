ALTER TABLE generated_emails 
ADD COLUMN content_type_id INTEGER REFERENCES content_types(id);