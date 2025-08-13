import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { crawlerService, CrawlSettings } from '../services/crawler.js';
import { pdfService, PDFSettings } from '../services/pdf.js';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

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
    
    // 直接使用存储的文件名作为下载文件名
    const safeFileName = task.pdf_filename;
    
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

// 批量删除任务
router.delete('/batch', async (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task IDs array is required'
      });
    }

    // 获取任务信息（用于删除PDF文件）
    const { data: tasks } = await supabaseAdmin
      .from('scrape_tasks')
      .select('id, pdf_filename')
      .in('id', taskIds);

    // 删除相关结果记录
    const { error: resultError } = await supabaseAdmin
      .from('scrape_results')
      .delete()
      .in('task_id', taskIds);

    if (resultError) {
      console.error('Error deleting results:', resultError);
    }

    // 删除任务记录
    const { error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .delete()
      .in('id', taskIds);

    if (taskError) {
      console.error('Error deleting tasks:', taskError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete tasks'
      });
    }

    // 删除PDF文件
    if (tasks) {
      for (const task of tasks) {
        if (task.pdf_filename && pdfService.fileExists(task.pdf_filename)) {
          try {
            const filePath = pdfService.getFilePath(task.pdf_filename);
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error('Error deleting PDF file:', error);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `${taskIds.length} tasks deleted successfully`
    });

  } catch (error) {
    console.error('Batch delete tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 批量下载PDF文件
router.post('/download/batch', async (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task IDs array is required'
      });
    }

    // 获取任务信息
    const { data: tasks, error: taskError } = await supabaseAdmin
      .from('scrape_tasks')
      .select('id, title, pdf_filename, pdf_path, status')
      .in('id', taskIds)
      .eq('status', 'completed')
      .not('pdf_filename', 'is', null);

    if (taskError) {
      console.error('Database error:', taskError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks'
      });
    }

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No completed tasks with PDFs found'
      });
    }

    // 检查文件是否存在
    const availableTasks = tasks.filter(task => 
      task.pdf_filename && pdfService.fileExists(task.pdf_filename)
    );

    if (availableTasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No PDF files found'
      });
    }

    // 如果只有一个文件，直接返回该文件
    if (availableTasks.length === 1) {
      const task = availableTasks[0];
      const filePath = pdfService.getFilePath(task.pdf_filename);
      
      // 直接使用存储的文件名
      const safeFileName = task.pdf_filename;
      const encodedFileName = encodeURIComponent(safeFileName);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    // 多个文件时创建ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="batch_download.zip"');

    archive.pipe(res);

    // 添加文件到ZIP
    for (const task of availableTasks) {
      const filePath = pdfService.getFilePath(task.pdf_filename);
      
      // 直接使用存储的文件名
      const safeFileName = task.pdf_filename;

      archive.file(filePath, { name: safeFileName });
    }

    archive.finalize();

  } catch (error) {
    console.error('Batch download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

// 获取所有任务ID列表
router.get('/all-ids', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('scrape_tasks')
      .select('id')
      .order('created_at', { ascending: false });

    // 如果指定了状态过滤
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('Database error:', tasksError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch task IDs'
      });
    }

    const taskIds = tasks ? tasks.map(task => task.id) : [];

    res.json({
      success: true,
      data: {
        taskIds,
        total: taskIds.length
      }
    });

  } catch (error) {
    console.error('Get all task IDs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 获取选中任务的详细信息
router.post('/details', async (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task IDs array is required'
      });
    }

    // 获取任务详细信息
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('scrape_tasks')
      .select('id, url, title, status, created_at, updated_at, error_message, pdf_filename')
      .in('id', taskIds)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Database error:', tasksError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch task details'
      });
    }

    // 处理任务信息，添加PDF可用性检查
    const taskDetails = (tasks || []).map(task => ({
      id: task.id,
      url: task.url,
      title: task.title,
      status: task.status,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      errorMessage: task.error_message,
      pdfAvailable: !!(task.pdf_filename && pdfService.fileExists(task.pdf_filename)),
      pdfFilename: task.pdf_filename
    }));

    res.json({
      success: true,
      data: {
        tasks: taskDetails,
        total: taskDetails.length
      }
    });

  } catch (error) {
    console.error('Get task details error:', error);
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