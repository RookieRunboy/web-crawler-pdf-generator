import { toast } from 'sonner';

// 错误类型定义
export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high';
  action?: string;
}

// 错误代码映射
const ERROR_CODES: Record<string, ErrorDetails> = {
  // 网络错误
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    userMessage: '网络连接失败，请检查网络连接后重试',
    severity: 'medium',
    action: '检查网络连接'
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    message: 'Request timeout',
    userMessage: '请求超时，请稍后重试',
    severity: 'medium',
    action: '稍后重试'
  },
  
  // 任务相关错误
  TASK_CREATE_FAILED: {
    code: 'TASK_CREATE_FAILED',
    message: 'Failed to create task',
    userMessage: '创建任务失败，请检查输入的URL是否有效',
    severity: 'medium',
    action: '检查URL格式'
  },
  TASK_NOT_FOUND: {
    code: 'TASK_NOT_FOUND',
    message: 'Task not found',
    userMessage: '任务不存在或已被删除',
    severity: 'low',
    action: '刷新页面'
  },
  TASK_PROCESSING_FAILED: {
    code: 'TASK_PROCESSING_FAILED',
    message: 'Task processing failed',
    userMessage: '任务处理失败，可能是目标网站无法访问或内容格式不支持',
    severity: 'medium',
    action: '检查目标网站'
  },
  
  // 文件相关错误
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'File not found',
    userMessage: 'PDF文件不存在或已被删除',
    severity: 'low',
    action: '重新生成PDF'
  },
  DOWNLOAD_FAILED: {
    code: 'DOWNLOAD_FAILED',
    message: 'Download failed',
    userMessage: '下载失败，请稍后重试',
    severity: 'medium',
    action: '稍后重试'
  },
  
  // 批量操作错误
  BATCH_CREATE_FAILED: {
    code: 'BATCH_CREATE_FAILED',
    message: 'Failed to create batch task',
    userMessage: '创建批量任务失败，请检查输入数据格式',
    severity: 'medium',
    action: '检查数据格式'
  },
  BATCH_PROCESSING_FAILED: {
    code: 'BATCH_PROCESSING_FAILED',
    message: 'Batch processing failed',
    userMessage: '批量处理失败，部分任务可能无法完成',
    severity: 'medium',
    action: '查看详细错误'
  },
  
  // 设置相关错误
  SETTINGS_LOAD_FAILED: {
    code: 'SETTINGS_LOAD_FAILED',
    message: 'Failed to load settings',
    userMessage: '加载设置失败，将使用默认设置',
    severity: 'low',
    action: '刷新页面'
  },
  SETTINGS_SAVE_FAILED: {
    code: 'SETTINGS_SAVE_FAILED',
    message: 'Failed to save settings',
    userMessage: '保存设置失败，请重试',
    severity: 'medium',
    action: '重新保存'
  },
  
  // 权限错误
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized access',
    userMessage: '访问权限不足',
    severity: 'high',
    action: '检查权限'
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Access forbidden',
    userMessage: '访问被拒绝',
    severity: 'high',
    action: '联系管理员'
  },
  
  // 服务器错误
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    message: 'Internal server error',
    userMessage: '服务器内部错误，请稍后重试',
    severity: 'high',
    action: '稍后重试'
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
    userMessage: '服务暂时不可用，请稍后重试',
    severity: 'high',
    action: '稍后重试'
  },
  
  // 通用错误
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown error occurred',
    userMessage: '发生未知错误，请稍后重试',
    severity: 'medium',
    action: '稍后重试'
  }
};

// 错误处理类
export class ErrorHandler {
  // 根据错误消息推断错误类型
  static inferErrorCode(error: Error | string): string {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();
    
    // 网络相关错误
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (lowerMessage.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    
    // 任务相关错误
    if (lowerMessage.includes('create') && lowerMessage.includes('task')) {
      return 'TASK_CREATE_FAILED';
    }
    if (lowerMessage.includes('task') && lowerMessage.includes('not found')) {
      return 'TASK_NOT_FOUND';
    }
    if (lowerMessage.includes('processing') && lowerMessage.includes('failed')) {
      return 'TASK_PROCESSING_FAILED';
    }
    
    // 文件相关错误
    if (lowerMessage.includes('file') && lowerMessage.includes('not found')) {
      return 'FILE_NOT_FOUND';
    }
    if (lowerMessage.includes('download') && lowerMessage.includes('failed')) {
      return 'DOWNLOAD_FAILED';
    }
    
    // 批量操作错误
    if (lowerMessage.includes('batch') && lowerMessage.includes('create')) {
      return 'BATCH_CREATE_FAILED';
    }
    if (lowerMessage.includes('batch') && lowerMessage.includes('processing')) {
      return 'BATCH_PROCESSING_FAILED';
    }
    
    // 设置相关错误
    if (lowerMessage.includes('settings') && lowerMessage.includes('load')) {
      return 'SETTINGS_LOAD_FAILED';
    }
    if (lowerMessage.includes('settings') && lowerMessage.includes('save')) {
      return 'SETTINGS_SAVE_FAILED';
    }
    
    // HTTP状态码相关错误
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
      return 'UNAUTHORIZED';
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return 'FORBIDDEN';
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('server error')) {
      return 'SERVER_ERROR';
    }
    if (lowerMessage.includes('503') || lowerMessage.includes('service unavailable')) {
      return 'SERVICE_UNAVAILABLE';
    }
    
    return 'UNKNOWN_ERROR';
  }
  
  // 获取错误详情
  static getErrorDetails(errorCode: string): ErrorDetails {
    return ERROR_CODES[errorCode] || ERROR_CODES.UNKNOWN_ERROR;
  }
  
  // 处理错误并显示用户友好的消息
  static handleError(error: Error | string, context?: string): ErrorDetails {
    const errorCode = this.inferErrorCode(error);
    const errorDetails = this.getErrorDetails(errorCode);
    
    // 记录详细错误信息（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Details:', {
        context,
        errorCode,
        originalError: error,
        errorDetails,
        timestamp: new Date().toISOString()
      });
    }
    
    // 显示用户友好的错误消息
    this.showErrorToast(errorDetails, context);
    
    return errorDetails;
  }
  
  // 显示错误提示
  static showErrorToast(errorDetails: ErrorDetails, context?: string) {
    const message = context 
      ? `${context}: ${errorDetails.userMessage}`
      : errorDetails.userMessage;
    
    const description = errorDetails.action 
      ? `建议操作: ${errorDetails.action}`
      : undefined;
    
    switch (errorDetails.severity) {
      case 'high':
        toast.error(message, { description });
        break;
      case 'medium':
        toast.error(message, { description });
        break;
      case 'low':
        toast.warning(message, { description });
        break;
    }
  }
  
  // 显示成功消息
  static showSuccess(message: string, description?: string) {
    toast.success(message, { description });
  }
  
  // 显示信息消息
  static showInfo(message: string, description?: string) {
    toast.info(message, { description });
  }
  
  // 显示警告消息
  static showWarning(message: string, description?: string) {
    toast.warning(message, { description });
  }
}

// 便捷的错误处理函数
export const handleError = (error: Error | string, context?: string) => {
  return ErrorHandler.handleError(error, context);
};

export const showSuccess = (message: string, description?: string) => {
  ErrorHandler.showSuccess(message, description);
};

export const showInfo = (message: string, description?: string) => {
  ErrorHandler.showInfo(message, description);
};

export const showWarning = (message: string, description?: string) => {
  ErrorHandler.showWarning(message, description);
};