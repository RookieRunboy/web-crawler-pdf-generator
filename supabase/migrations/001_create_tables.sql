-- 创建爬取任务表
CREATE TABLE scrape_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建爬取结果表
CREATE TABLE scrape_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES scrape_tasks(id) ON DELETE CASCADE,
  content TEXT,
  pdf_url TEXT,
  file_size INTEGER,
  page_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户设置表
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pdf_format VARCHAR(10) DEFAULT 'A4',
  include_images BOOLEAN DEFAULT true,
  max_pages INTEGER DEFAULT 50,
  timeout INTEGER DEFAULT 30000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用行级安全策略
ALTER TABLE scrape_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- scrape_tasks表策略
CREATE POLICY "Users can view own tasks" ON scrape_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON scrape_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON scrape_tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- scrape_results表策略
CREATE POLICY "Users can view own results" ON scrape_results
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM scrape_tasks 
    WHERE scrape_tasks.id = scrape_results.task_id 
    AND scrape_tasks.user_id = auth.uid()
  ));

CREATE POLICY "Service can insert results" ON scrape_results
  FOR INSERT WITH CHECK (true);

-- user_settings表策略
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- 创建索引
CREATE INDEX idx_scrape_tasks_user_id ON scrape_tasks(user_id);
CREATE INDEX idx_scrape_tasks_status ON scrape_tasks(status);
CREATE INDEX idx_scrape_results_task_id ON scrape_results(task_id);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- 授权给anon和authenticated角色
GRANT SELECT, INSERT, UPDATE ON scrape_tasks TO authenticated;
GRANT SELECT ON scrape_tasks TO anon;
GRANT SELECT, INSERT ON scrape_results TO authenticated;
GRANT SELECT ON scrape_results TO anon;
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT SELECT ON user_settings TO anon;