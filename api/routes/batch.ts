import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { crawlerService, CrawlSettings } from '../services/crawler.js';
import { pdfService } from '../services/pdf.js';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

const router = Router();

// 解析批量数据的接口
interface ParsedBatchData {
  title: string;
  url: string;
  isValid: boolean;
  error?: string;
}

// 批量数据解析函数
function parseBatchData(rawData: string): ParsedBatchData[] {
  const lines = rawData.split(/\r?\n/).filter(line => line.trim());
  const results: ParsedBatchData[] = [];
  const seenUrls = new Set<string>();

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) {
      results.push({
        title: line.trim(),
        url: '',
        isValid: false,
        error: '格式错误：应为"标题\t链接"格式'
      });
      continue;
    }

    const title = parts[0].trim();
    let url = parts[1].trim();

    // URL格式验证和自动补全
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
    } catch {
      results.push({
        title,
        url,
        isValid: false,
        error: 'URL格式无效'
      });
      continue;
    }

    // 检查重复URL
    if (seenUrls.has(url)) {
      results.push({
        title,
        url,
        isValid: false,
        error: 'URL重复'
      });
      continue;
    }

    seenUrls.add(url);
    results.push({
      title,
      url,
      isValid: true
    });
  }

  return results;
}

// 创建批量爬取任务
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { batchData, options = {} } = req.body;

    if (!batchData || typeof batchData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'batchData is required and must be a string'
      });
    }

    // 解析批量数据
    const parsedData = parseBatchData(batchData);
    const validTasks = parsedData.filter(item => item.isValid);
    const invalidTasks = parsedData.filter(item => !item.isValid);

    if (validTasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有有效的任务数据',
        invalidTasks
      });
    }

    const batchId = uuidv4();
    const now = new Date().toISOString();
    const batchName = `批量任务_${new Date().toLocaleString('zh-CN')}`;

    // 创建批量任务记录
    const { data: batchTask, error: batchError } = await supabaseAdmin
      .from('batch_tasks')
      .insert({
        id: batchId,
        batch_name: batchName,
        status: 'pending',
        total_tasks: validTasks.length,
        completed_tasks: 0,
        failed_tasks: 0,
        user_id: null, // TODO: Get actual user ID from auth
        options: JSON.stringify({
          includeImages: options.includeImages ?? true,
          timeout: options.timeout ?? 30,
          concurrency: Math.min(options.concurrency ?? 3, 10)
        }),
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (batchError) {
      console.error('Database error:', batchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create batch task'
      });
    }

    // 创建子任务记录
    const subTasks = validTasks.map(task => ({
      id: uuidv4(),
      batch_id: batchId,
      url: task.url,
      title: task.title,
      status: 'pending',
      settings: JSON.stringify(options),
      created_at: now,
      updated_at: now
    }));

    const { error: tasksError } = await supabaseAdmin
      .from('scrape_tasks')
      .insert(subTasks);

    if (tasksError) {
      console.error('Database error:', tasksError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create sub tasks'
      });
    }

    // 异步处理批量任务
    setImmediate(async () => {
      try {
        await processBatchTasks(batchId, subTasks, options);
      } catch (error) {
        console.error('Batch processing error:', error);
      }
    });

    res.json({
      success: true,
      data: {
        batchId,
        totalTasks: validTasks.length,
        status: 'pending',
        createdAt: now,
        invalidTasks: invalidTasks.length > 0 ? invalidTasks : undefined
      }
    });

  } catch (error) {
    console.error('Create batch task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 批量任务处理函数
async function processBatchTasks(batchId: string, tasks: any[], options: any) {
  const concurrency = Math.min(options.concurrency ?? 3, 10);
  const crawlSettings: CrawlSettings = {
    includeImages: options.includeImages ?? true,
    timeout: (options.timeout ?? 30) * 1000
  };

  // 更新批量任务状态为处理中
  await supabaseAdmin
    .from('batch_tasks')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', batchId);

  let completedCount = 0;
  let failedCount = 0;
  const activeJobs = new Map<string, Promise<any>>();
  const taskQueue = [...tasks];

  // 并发处理任务
  while (taskQueue.length > 0 || activeJobs.size > 0) {
    // 启动新任务直到达到并发限制
    while (activeJobs.size < concurrency && taskQueue.length > 0) {
      const task = taskQueue.shift()!;
      const jobPromise = processSubTask(task, crawlSettings);
      activeJobs.set(task.id, jobPromise);
    }

    // 等待任何一个任务完成
    if (activeJobs.size > 0) {
      const completedTaskId = await Promise.race(
        Array.from(activeJobs.entries()).map(async ([taskId, promise]) => {
          try {
            await promise;
            completedCount++;
          } catch (error) {
            console.error(`Task ${taskId} failed:`, error);
            failedCount++;
          }
          return taskId;
        })
      );

      activeJobs.delete(completedTaskId);

      // 更新批量任务进度
      await supabaseAdmin
        .from('batch_tasks')
        .update({
          completed_tasks: completedCount,
          failed_tasks: failedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);
    }
  }

  // 生成ZIP文件
  try {
    const zipPath = await createZipFile(batchId);
    const finalStatus = failedCount === 0 ? 'completed' : (completedCount > 0 ? 'partial' : 'failed');

    await supabaseAdmin
      .from('batch_tasks')
      .update({
        status: finalStatus,
        zip_filename: path.basename(zipPath),
        zip_path: zipPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);
  } catch (error) {
    console.error('ZIP creation failed:', error);
    await supabaseAdmin
      .from('batch_tasks')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);
  }
}

// 处理单个子任务
async function processSubTask(task: any, crawlSettings: CrawlSettings) {
  try {
    await crawlerService.processCrawlTask(task.id, task.url, crawlSettings);
    const pdfResult = await pdfService.generatePDFForTask(task.id);
    if (!pdfResult.success) {
      throw new Error(pdfResult.error);
    }
  } catch (error) {
    throw error;
  }
}

// 创建ZIP文件
async function createZipFile(batchId: string): Promise<string> {
  const { data: tasks } = await supabaseAdmin
    .from('scrape_tasks')
    .select('id, title, pdf_filename, pdf_path')
    .eq('batch_id', batchId)
    .eq('status', 'completed')
    .not('pdf_filename', 'is', null);

  if (!tasks || tasks.length === 0) {
    throw new Error('No completed tasks with PDF files');
  }

  const batchDir = path.join(process.cwd(), 'downloads', 'batch');
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }

  const zipPath = path.join(batchDir, `batch_${batchId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    archive.pipe(output);

    for (const task of tasks) {
      const pdfPath = pdfService.getFilePath(task.pdf_filename);
      if (fs.existsSync(pdfPath)) {
        const cleanTitle = task.title?.replace(/["\\/:*?<>|\r\n\t]/g, '_') || 'untitled';
        archive.file(pdfPath, { name: `${cleanTitle}.pdf` });
      }
    }

    archive.finalize();
  });
}

// 获取批量任务状态
router.get('/status/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: 'Batch ID is required'
      });
    }

    // 获取批量任务信息
    const { data: batchTask, error: batchError } = await supabaseAdmin
      .from('batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batchTask) {
      return res.status(404).json({
        success: false,
        error: 'Batch task not found'
      });
    }

    // 获取子任务信息
    const { data: subTasks } = await supabaseAdmin
      .from('scrape_tasks')
      .select('id, title, url, status, pdf_filename, error_message')
      .eq('batch_id', batchId)
      .order('created_at');

    const progress = batchTask.total_tasks > 0 
      ? Math.round(((batchTask.completed_tasks + batchTask.failed_tasks) / batchTask.total_tasks) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        batchId: batchTask.id,
        batchName: batchTask.batch_name,
        status: batchTask.status,
        totalTasks: batchTask.total_tasks,
        completedTasks: batchTask.completed_tasks,
        failedTasks: batchTask.failed_tasks,
        progress,
        zipAvailable: !!batchTask.zip_filename,
        createdAt: batchTask.created_at,
        updatedAt: batchTask.updated_at,
        tasks: (subTasks || []).map(task => ({
          taskId: task.id,
          title: task.title,
          url: task.url,
          status: task.status,
          pdfAvailable: !!task.pdf_filename,
          errorMessage: task.error_message
        }))
      }
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 批量下载PDF
router.get('/download/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: 'Batch ID is required'
      });
    }

    // 获取批量任务信息
    const { data: batchTask, error: batchError } = await supabaseAdmin
      .from('batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batchTask) {
      return res.status(404).json({
        success: false,
        error: 'Batch task not found'
      });
    }

    if (!batchTask.zip_filename || !batchTask.zip_path) {
      return res.status(404).json({
        success: false,
        error: 'ZIP file not available for this batch'
      });
    }

    // 检查ZIP文件是否存在
    if (!fs.existsSync(batchTask.zip_path)) {
      return res.status(404).json({
        success: false,
        error: 'ZIP file not found'
      });
    }

    const fileName = `${batchTask.batch_name || 'batch'}_${batchId.substring(0, 8)}.zip`;
    const cleanFileName = fileName.replace(/["\\/:*?<>|\r\n\t]/g, '_');
    const encodedFileName = encodeURIComponent(cleanFileName);

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodedFileName}`);
    
    // 发送文件
    const fileStream = fs.createReadStream(batchTask.zip_path);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error reading ZIP file'
        });
      }
    });

  } catch (error) {
    console.error('Download batch error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

// 获取批量任务历史记录
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('batch_tasks')
      .select('id, batch_name, status, total_tasks, completed_tasks, failed_tasks, zip_filename, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // 如果指定了状态过滤
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: batches, error: batchesError } = await query;

    if (batchesError) {
      console.error('Database error:', batchesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch batch tasks'
      });
    }

    // 获取总数
    let countQuery = supabaseAdmin
      .from('batch_tasks')
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
        batches: (batches || []).map(batch => ({
          batchId: batch.id,
          batchName: batch.batch_name,
          status: batch.status,
          totalTasks: batch.total_tasks,
          completedTasks: batch.completed_tasks,
          failedTasks: batch.failed_tasks,
          zipAvailable: !!batch.zip_filename,
          createdAt: batch.created_at,
          updatedAt: batch.updated_at
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get batch history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 删除批量任务
router.delete('/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: 'Batch ID is required'
      });
    }

    // 获取批量任务信息（用于删除ZIP文件）
    const { data: batchTask } = await supabaseAdmin
      .from('batch_tasks')
      .select('zip_path')
      .eq('id', batchId)
      .single();

    // 获取子任务的PDF文件信息
    const { data: subTasks } = await supabaseAdmin
      .from('scrape_tasks')
      .select('id, pdf_filename')
      .eq('batch_id', batchId);

    // 删除子任务的结果记录
    if (subTasks && subTasks.length > 0) {
      const taskIds = subTasks.map(task => task.id);
      await supabaseAdmin
        .from('scrape_results')
        .delete()
        .in('task_id', taskIds);
    }

    // 删除子任务记录
    const { error: tasksError } = await supabaseAdmin
      .from('scrape_tasks')
      .delete()
      .eq('batch_id', batchId);

    if (tasksError) {
      console.error('Error deleting sub tasks:', tasksError);
    }

    // 删除批量任务记录
    const { error: batchError } = await supabaseAdmin
      .from('batch_tasks')
      .delete()
      .eq('id', batchId);

    if (batchError) {
      console.error('Error deleting batch task:', batchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete batch task'
      });
    }

    // 删除ZIP文件
    if (batchTask?.zip_path && fs.existsSync(batchTask.zip_path)) {
      try {
        fs.unlinkSync(batchTask.zip_path);
      } catch (error) {
        console.error('Error deleting ZIP file:', error);
      }
    }

    // 删除PDF文件
    if (subTasks) {
      for (const task of subTasks) {
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
      message: 'Batch task deleted successfully'
    });

  } catch (error) {
    console.error('Delete batch task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;