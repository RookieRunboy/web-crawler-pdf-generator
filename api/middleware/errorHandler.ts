import { Request, Response, NextFunction } from 'express';

// 自定义错误类
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 错误处理中间件
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 处理不同类型的错误
  if (err.name === 'ValidationError') {
    const message = '输入数据验证失败';
    error = new AppError(message, 400);
  }

  if (err.name === 'CastError') {
    const message = '无效的数据格式';
    error = new AppError(message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = '无效的认证令牌';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = '认证令牌已过期';
    error = new AppError(message, 401);
  }

  // 处理 Supabase 错误
  if (err.message?.includes('duplicate key value')) {
    const message = '数据已存在';
    error = new AppError(message, 409);
  }

  // 处理网络超时错误
  if (err.message?.includes('timeout') || err.name === 'TimeoutError') {
    const message = '请求超时，请稍后重试';
    error = new AppError(message, 408);
  }

  // 处理爬虫相关错误
  if (err.message?.includes('Page crashed') || err.message?.includes('Navigation timeout')) {
    const message = '网页爬取失败，请检查目标网址';
    error = new AppError(message, 422);
  }

  // 处理文件相关错误
  if (err.message?.includes('ENOENT') || err.message?.includes('file not found')) {
    const message = '文件未找到';
    error = new AppError(message, 404);
  }

  // 处理 Python 脚本错误
  if (err.message?.includes('python') || err.message?.includes('spawn')) {
    const message = 'Excel 处理服务暂时不可用';
    error = new AppError(message, 503);
  }

  // 默认错误响应
  const statusCode = (error as AppError).statusCode || 500;
  const message = error.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
};

// 404 处理中间件
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`路径 ${req.originalUrl} 未找到`, 404);
  next(error);
};

// 异步错误捕获包装器
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};