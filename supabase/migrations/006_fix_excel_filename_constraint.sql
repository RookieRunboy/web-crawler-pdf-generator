-- Fix excel_filename column constraint - it should allow NULL values
ALTER TABLE batch_tasks ALTER COLUMN excel_filename DROP NOT NULL;