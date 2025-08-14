-- Create excel_batch_tasks table for Excel batch processing
CREATE TABLE excel_batch_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    excel_filename VARCHAR(255) NOT NULL,
    excel_path VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    zip_filename VARCHAR(255),
    zip_path VARCHAR(500),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_excel_batch_tasks_status ON excel_batch_tasks(status);
CREATE INDEX idx_excel_batch_tasks_created_at ON excel_batch_tasks(created_at);
CREATE INDEX idx_excel_batch_tasks_excel_filename ON excel_batch_tasks(excel_filename);

-- Enable Row Level Security
ALTER TABLE excel_batch_tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous access (similar to batch_tasks)
CREATE POLICY "Allow anonymous access to excel_batch_tasks" ON excel_batch_tasks
    FOR ALL USING (true);

-- Grant permissions to anon and authenticated roles
GRANT ALL PRIVILEGES ON excel_batch_tasks TO anon;
GRANT ALL PRIVILEGES ON excel_batch_tasks TO authenticated;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_excel_batch_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_excel_batch_tasks_updated_at
    BEFORE UPDATE ON excel_batch_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_excel_batch_tasks_updated_at();