import { ParsedBatchData } from '../lib/supabase';

/**
 * 验证URL格式
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 解析批量数据（标题\t链接格式）
 */
export function parseBatchData(rawData: string): ParsedBatchData {
  const lines = rawData.split(/\r?\n/).filter(line => line.trim());
  const validTasks: Array<{ title: string; url: string }> = [];
  const invalidTasks: Array<{ title: string; url: string; error: string }> = [];
  const seenUrls = new Set<string>();

  for (const line of lines) {
    const parts = line.split('\t');
    
    if (parts.length < 2) {
      invalidTasks.push({
        title: line.trim(),
        url: '',
        error: '格式错误：应为"标题\t链接"格式'
      });
      continue;
    }

    const title = parts[0].trim();
    const url = parts[1].trim();

    // 验证标题
    if (!title) {
      invalidTasks.push({
        title: '(空标题)',
        url,
        error: '标题不能为空'
      });
      continue;
    }

    // 验证URL
    if (!url) {
      invalidTasks.push({
        title,
        url: '(空链接)',
        error: 'URL不能为空'
      });
      continue;
    }

    if (!isValidUrl(url)) {
      invalidTasks.push({
        title,
        url,
        error: 'URL格式无效'
      });
      continue;
    }

    // 检查重复URL
    if (seenUrls.has(url)) {
      invalidTasks.push({
        title,
        url,
        error: 'URL重复'
      });
      continue;
    }

    seenUrls.add(url);
    validTasks.push({ title, url });
  }

  return {
    validTasks,
    invalidTasks
  };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化持续时间
 */
export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const duration = end.getTime() - start.getTime();
  
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 生成安全的文件名
 */
export function sanitizeFilename(filename: string): string {
  // 移除或替换不安全的字符
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100); // 限制长度
}

/**
 * 计算批量任务进度
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * 获取状态颜色类名
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'processing':
      return 'text-blue-600 bg-blue-100';
    case 'completed':
      return 'text-green-600 bg-green-100';
    case 'failed':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * 获取状态文本
 */
export function getStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '未知';
  }
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 验证批量选项
 */
export function validateBatchOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof options.includeImages !== 'boolean') {
    errors.push('includeImages 必须是布尔值');
  }
  
  // timeout验证：接受秒数（5-300秒）
  if (typeof options.timeout !== 'number' || options.timeout < 5 || options.timeout > 300) {
    errors.push('timeout 必须是 5-300 之间的数字（秒）');
  }
  
  if (typeof options.concurrency !== 'number' || options.concurrency < 1 || options.concurrency > 10) {
    errors.push('concurrency 必须是 1-10 之间的数字');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}