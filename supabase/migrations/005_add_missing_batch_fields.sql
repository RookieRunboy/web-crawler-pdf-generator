-- Add missing fields to batch_tasks table
ALTER TABLE batch_tasks ADD COLUMN IF NOT EXISTS excel_filename VARCHAR(255);
ALTER TABLE batch_tasks ADD COLUMN IF NOT EXISTS zip_filename VARCHAR(255);
ALTER TABLE batch_tasks ADD COLUMN IF NOT EXISTS zip_path VARCHAR(1000);

-- Update existing records to have null values for these fields (they will be populated when tasks complete)
-- No need to set default values as these fields are populated during task processing