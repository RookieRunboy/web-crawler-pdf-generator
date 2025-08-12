import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://nsgnqlwutkyqbmnvdhtz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ25xbHd1dGt5cWJtbnZkaHR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk4MTc2MywiZXhwIjoyMDcwNTU3NzYzfQ._ETcMM4kZUt8nBbhHc1gM8LVuh45PUOZSyVjEuwwKzI';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ25xbHd1dGt5cWJtbnZkaHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODE3NjMsImV4cCI6MjA3MDU1Nzc2M30.wPOcQv4YHab_M8_FWO3Az_20yg4qYXBSljm3Gq4bhcM';

// 用于服务端操作的客户端（具有完整权限）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 用于客户端操作的客户端（受RLS限制）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabaseUrl, supabaseAnonKey };