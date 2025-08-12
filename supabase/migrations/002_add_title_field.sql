-- 为scrape_tasks表添加title字段
ALTER TABLE scrape_tasks ADD COLUMN title TEXT;

-- 为scrape_tasks表添加其他缺失的字段
ALTER TABLE scrape_tasks ADD COLUMN error_message TEXT;
ALTER TABLE scrape_tasks ADD COLUMN pdf_filename TEXT;
ALTER TABLE scrape_tasks ADD COLUMN pdf_path TEXT;

-- 创建索引以提高查询性能
CREATE INDEX idx_scrape_tasks_title ON scrape_tasks(title);
CREATE INDEX idx_scrape_tasks_pdf_filename ON scrape_tasks(pdf_filename);