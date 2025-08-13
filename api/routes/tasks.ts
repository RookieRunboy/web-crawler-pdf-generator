import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { crawlerService, CrawlSettings } from '../services/crawler.js';
import { pdfService, PDFSettings } from '../services/pdf.js';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// 创建爬取任务
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { url, title, settings } = req.body;

    // 验证URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required and must be a string'
      });
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const taskId = uuidv4();
    const now = new Date().toISOString();

    // 创建任务记录
    const { data: task, error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .insert({
        id: taskId,
        url,
        title: title || null,
        status: 'pending',
        settings: settings ? JSON.stringify(settings) : null,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (taskError) {
      console.error('Database error:', taskError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create task'
      });
    }

    // 异步处理爬取任务
    setImmediate(async () => {
      try {
        const crawlSettings: CrawlSettings = settings || {};
        await crawlerService.processCrawlTask(taskId, url, crawlSettings);
        
        // 爬取完成后生成PDF
        const pdfResult = await pdfService.generatePDFForTask(taskId);
        if (!pdfResult.success) {
          console.error('PDF generation failed:', pdfResult.error);
        }
      } catch (error) {
        console.error('Task processing error:', error);
      }
    });

    res.json({
      success: true,
      data: {
        taskId,
        status: 'pending',
        message: 'Task created successfully'
      }
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 获取任务状态
router.get('/status/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }

    // 获取任务信息
    const { data: task, error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // 获取结果信息（如果有）
    const { data: result } = await supabaseAdmin
      .from('scrape_results')
      .select('*')
      .eq('task_id', taskId)
      .single();

    const response: any = {
      success: true,
      data: {
        taskId: task.id,
        url: task.url,
        title: task.title,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        errorMessage: task.error_message
      }
    };

    // 如果有PDF文件信息，添加到响应中
    if (task.pdf_filename) {
      response.data.pdfAvailable = true;
      response.data.pdfFilename = task.pdf_filename;
    }

    // 如果有结果内容，添加预览
    if (result && result.content) {
      response.data.contentPreview = result.content.substring(0, 200) + '...';
    }

    res.json(response);

  } catch (error) {
    console.error('Get task status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 下载PDF文件
router.get('/download/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }

    // 获取任务信息
    const { data: task, error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (!task.pdf_filename || !task.pdf_path) {
      return res.status(404).json({
        success: false,
        error: 'PDF not available for this task'
      });
    }

    // 检查文件是否存在
    if (!pdfService.fileExists(task.pdf_filename)) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found'
      });
    }

    const filePath = pdfService.getFilePath(task.pdf_filename);
    const rawTitle = (task.title || 'webpage').toString();
    const rawFileName = `${rawTitle}_${taskId.substring(0, 8)}.pdf`;
    
    // 更严格地清理文件名，确保HTTP头部安全
    const cleanFileName = rawFileName
      .replace(/[\x00-\x1f\x7f-\xff]/g, '') // 移除所有控制字符和扩展ASCII字符
      .replace(/["\\/:*?<>|\r\n\t\v\f]/g, '_') // 替换文件系统和HTTP不安全字符
      .replace(/[^\w\u4e00-\u9fff._-]/g, '_') // 只保留字母数字、中文、点、下划线、连字符
      .replace(/_{2,}/g, '_') // 合并多个连续下划线
      .replace(/^_+|_+$/g, '') // 移除开头和结尾的下划线
      .trim();
    
    // 确保文件名不为空且长度合理
    const safeFileName = (cleanFileName && cleanFileName.length > 0) ? 
      cleanFileName.substring(0, 100) : 'download.pdf';
    
    // 对文件名进行URL编码
    const encodedFileName = encodeURIComponent(safeFileName);

    // 设置响应头，使用更安全的格式
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error reading PDF file'
        });
      }
    });

  } catch (error) {
    console.error('Download PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

// 获取任务历史记录
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('scrape_tasks')
      .select('id, url, title, status, created_at, updated_at, error_message, pdf_filename')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // 如果指定了状态过滤
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('Database error:', tasksError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks'
      });
    }

    // 获取总数
    let countQuery = supabaseAdmin
      .from('scrape_tasks')
      .select('*', { count: 'exact', head: true });
    
    if (status && typeof status === 'string') {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Count error:', countError);
    }

    res.json({
      success: true,
      data: {
        tasks: tasks || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 删除任务
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }

    // 获取任务信息（用于删除PDF文件）
    const { data: task } = await supabaseAdmin
      .from('scrape_tasks')
      .select('pdf_filename')
      .eq('id', taskId)
      .single();

    // 删除相关记录
    const { error: resultError } = await supabaseAdmin
      .from('scrape_results')
      .delete()
      .eq('task_id', taskId);

    if (resultError) {
      console.error('Error deleting result:', resultError);
    }

    const { error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .delete()
      .eq('id', taskId);

    if (taskError) {
      console.error('Error deleting task:', taskError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete task'
      });
    }

    // 删除PDF文件
    if (task?.pdf_filename && pdfService.fileExists(task.pdf_filename)) {
      try {
        const filePath = pdfService.getFilePath(task.pdf_filename);
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Error deleting PDF file:', error);
      }
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;