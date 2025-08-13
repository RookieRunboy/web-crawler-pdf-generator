import { createClient } from '@supabase/supabase-js';

// 检查必需的环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required');
}

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
  batch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BatchTask {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  options?: string;
  zip_filename?: string;
  zip_path?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
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

// 批量处理相关类型
export interface BatchOptions {
  includeImages: boolean;
  timeout: number;
  concurrency: number;
}

export interface ParsedBatchData {
  validTasks: Array<{
    title: string;
    url: string;
  }>;
  invalidTasks: Array<{
    title: string;
    url: string;
    error: string;
  }>;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BatchCreateResponse {
  batchId: string;
  totalTasks: number;
  validTasks: number;
  invalidTasks: number;
}

export interface BatchStatusResponse {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  zip_filename?: string;
  zip_path?: string;
  created_at: string;
  completed_at?: string;
  tasks: Array<{
    id: string;
    title: string;
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
    completed_at?: string;
    error_message?: string;
    pdf_filename?: string;
    pdf_path?: string;
  }>;
}