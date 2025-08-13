-- Add missing options column to batch_tasks table
ALTER TABLE batch_tasks ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}';

-- Update existing records to have empty options object
UPDATE batch_tasks SET options = '{}' WHERE options IS NULL;