-- Add user_id column to batch_tasks table (allow NULL initially)
ALTER TABLE batch_tasks ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- For existing records, we'll set user_id to NULL and handle this in the application
-- In a real scenario, you'd want to assign these to actual users
-- For now, we'll delete any existing records to avoid issues
DELETE FROM batch_tasks WHERE user_id IS NULL;

-- Now make user_id NOT NULL for future records
ALTER TABLE batch_tasks ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policy for batch_tasks
ALTER TABLE batch_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own batch tasks
CREATE POLICY "Users can view own batch tasks" ON batch_tasks
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own batch tasks
CREATE POLICY "Users can insert own batch tasks" ON batch_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own batch tasks
CREATE POLICY "Users can update own batch tasks" ON batch_tasks
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own batch tasks
CREATE POLICY "Users can delete own batch tasks" ON batch_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL PRIVILEGES ON batch_tasks TO authenticated;
GRANT SELECT ON batch_tasks TO anon;