-- Fix user_id constraint in batch_tasks table
-- Remove NOT NULL constraint to allow anonymous batch creation

-- First, drop existing RLS policies that require user authentication
DROP POLICY IF EXISTS "Users can view own batch tasks" ON batch_tasks;
DROP POLICY IF EXISTS "Users can insert own batch tasks" ON batch_tasks;
DROP POLICY IF EXISTS "Users can update own batch tasks" ON batch_tasks;
DROP POLICY IF EXISTS "Users can delete own batch tasks" ON batch_tasks;

-- Remove NOT NULL constraint from user_id
ALTER TABLE batch_tasks ALTER COLUMN user_id DROP NOT NULL;

-- Create new RLS policies that allow anonymous access
-- Policy: Allow anonymous users to view batch tasks
CREATE POLICY "Allow anonymous view batch tasks" ON batch_tasks
    FOR SELECT USING (true);

-- Policy: Allow anonymous users to insert batch tasks
CREATE POLICY "Allow anonymous insert batch tasks" ON batch_tasks
    FOR INSERT WITH CHECK (true);

-- Policy: Allow anonymous users to update batch tasks
CREATE POLICY "Allow anonymous update batch tasks" ON batch_tasks
    FOR UPDATE USING (true);

-- Policy: Allow anonymous users to delete batch tasks
CREATE POLICY "Allow anonymous delete batch tasks" ON batch_tasks
    FOR DELETE USING (true);

-- Ensure proper permissions for anon role
GRANT ALL PRIVILEGES ON batch_tasks TO anon;
GRANT ALL PRIVILEGES ON batch_tasks TO authenticated;