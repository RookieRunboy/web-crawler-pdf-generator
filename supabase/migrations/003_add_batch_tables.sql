-- 创建批量任务表
CREATE TABLE batch_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    options JSONB DEFAULT '{}',
    zip_filename VARCHAR(255),
    zip_path VARCHAR(1000),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为scrape_tasks表添加batch_id字段
ALTER TABLE scrape_tasks ADD COLUMN batch_id UUID REFERENCES batch_tasks(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX idx_batch_tasks_user_id ON batch_tasks(user_id);
CREATE INDEX idx_batch_tasks_status ON batch_tasks(status);
CREATE INDEX idx_batch_tasks_created_at ON batch_tasks(created_at DESC);
CREATE INDEX idx_scrape_tasks_batch_id ON scrape_tasks(batch_id);

-- 启用行级安全策略
ALTER TABLE batch_tasks ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- batch_tasks表策略
CREATE POLICY "Users can view own batch tasks" ON batch_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own batch tasks" ON batch_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch tasks" ON batch_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own batch tasks" ON batch_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- 授权给anon和authenticated角色
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_tasks TO authenticated;
GRANT SELECT ON batch_tasks TO anon;

-- 初始化示例数据（可选）
INSERT INTO batch_tasks (batch_name, status, total_tasks, completed_tasks, failed_tasks, options, user_id) VALUES 
('示例批量任务', 'completed', 2, 2, 0, '{"includeImages": true, "timeout": 30, "concurrency": 3}', '00000000-0000-0000-0000-000000000000'),
('测试批量任务', 'failed', 3, 1, 2, '{"includeImages": false, "timeout": 60, "concurrency": 2}', '00000000-0000-0000-0000-000000000000');