import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nsgnqlwutkyqbmnvdhtz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ25xbHd1dGt5cWJtbnZkaHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODE3NjMsImV4cCI6MjA3MDU1Nzc2M30.wPOcQv4YHab_M8_FWO3Az_20yg4qYXBSljm3Gq4bhcM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库类型定义
export interface ScrapeTask {
  id: string;
  url: string;
  title?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  settings?: string;
  pdf_path?: string;
  pdf_filename?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapeResult {
  id: string;
  task_id: string;
  content?: string;
  error_message?: string;
  created_at: string;
}

export interface UserSettings {
  id: string;
  crawl_settings?: string;
  pdf_settings?: string;
  general_settings?: string;
  created_at: string;
  updated_at: string;
}