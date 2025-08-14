import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface ExcelProcessResult {
  success: boolean;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  zip_path: string | null;
  errors: string[];
}

interface ExcelBatchTask {
  id: string;
  excel_filename: string;
  excel_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  zip_filename?: string;
  zip_path?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// 处理Excel文件批量爬取
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { excelFilename } = req.body;

    if (!excelFilename) {
      return res.status(400).json({
        success: false,
        error: 'Excel filename is required'
      });
    }

    // 检查Excel文件是否存在
    const inputDir = path.join(process.cwd(), 'inputexcel');
    const excelPath = path.join(inputDir, excelFilename);

    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({
        success: false,
        error: 'Excel file not found'
      });
    }

    // 创建批量任务记录
    const batchId = uuidv4();
    const outputDir = path.join(process.cwd(), 'temp', 'excel_batch', batchId);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const batchTask: Partial<ExcelBatchTask> = {
      id: batchId,
      excel_filename: excelFilename,
      excel_path: excelPath,
      status: 'pending',
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 保存到数据库
    const { error: insertError } = await supabaseAdmin
      .from('excel_batch_tasks')
      .insert(batchTask);

    if (insertError) {
      console.error('Failed to create excel batch task:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create batch task'
      });
    }

    // 异步处理Excel文件
    processExcelFileAsync(batchId, excelPath, outputDir);

    res.json({
      success: true,
      data: {
        batchId,
        status: 'pending',
        message: 'Excel processing started'
      }
    });

  } catch (error) {
    console.error('Excel process error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 异步处理Excel文件
async function processExcelFileAsync(batchId: string, excelPath: string, outputDir: string) {
  try {
    // 更新状态为处理中
    await supabaseAdmin
      .from('excel_batch_tasks')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    // 调用Python脚本
    const pythonScript = path.join(process.cwd(), 'api', 'python_scripts', 'excel_batch_processor.py');
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.com/api' 
      : 'http://localhost:3001/api';

    const result = await runPythonScript(pythonScript, [excelPath, outputDir, apiBaseUrl]);

    if (result.success) {
      // 移动ZIP文件到downloads目录
      const downloadsDir = path.join(process.cwd(), 'downloads', 'excel_batch');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const zipFilename = path.basename(result.zip_path!);
      const finalZipPath = path.join(downloadsDir, `${batchId}_${zipFilename}`);
      
      // 移动文件
      fs.renameSync(result.zip_path!, finalZipPath);

      // 更新数据库记录
      await supabaseAdmin
        .from('excel_batch_tasks')
        .update({
          status: 'completed',
          total_tasks: result.total_tasks,
          completed_tasks: result.completed_tasks,
          failed_tasks: result.failed_tasks,
          zip_filename: zipFilename,
          zip_path: finalZipPath,
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);

      console.log(`Excel batch processing completed: ${batchId}`);
    } else {
      // 处理失败
      await supabaseAdmin
        .from('excel_batch_tasks')
        .update({
          status: 'failed',
          total_tasks: result.total_tasks,
          completed_tasks: result.completed_tasks,
          failed_tasks: result.failed_tasks,
          error_message: result.errors.join('; '),
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);

      console.error(`Excel batch processing failed: ${batchId}`, result.errors);
    }

    // 清理临时目录
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory:', cleanupError);
    }

  } catch (error) {
    console.error('Excel processing error:', error);
    
    // 更新状态为失败
    await supabaseAdmin
      .from('excel_batch_tasks')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);
  }
}

// 运行Python脚本
function runPythonScript(scriptPath: string, args: string[]): Promise<ExcelProcessResult> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, ...args]);
    
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse Python script output: ${parseError}`));
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
}

// 获取Excel批量任务状态
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
      .from('excel_batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batchTask) {
      return res.status(404).json({
        success: false,
        error: 'Excel batch task not found'
      });
    }

    const progress = batchTask.total_tasks > 0 
      ? Math.round(((batchTask.completed_tasks + batchTask.failed_tasks) / batchTask.total_tasks) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        batchId: batchTask.id,
        excelFilename: batchTask.excel_filename,
        status: batchTask.status,
        totalTasks: batchTask.total_tasks,
        completedTasks: batchTask.completed_tasks,
        failedTasks: batchTask.failed_tasks,
        progress,
        zipAvailable: !!batchTask.zip_filename,
        errorMessage: batchTask.error_message,
        createdAt: batchTask.created_at,
        updatedAt: batchTask.updated_at
      }
    });

  } catch (error) {
    console.error('Get excel batch status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 下载Excel批量处理结果
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
      .from('excel_batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batchTask) {
      return res.status(404).json({
        success: false,
        error: 'Excel batch task not found'
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

    const fileName = batchTask.zip_filename;
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
    console.error('Download excel batch error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

// 获取Excel批量任务历史记录
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('excel_batch_tasks')
      .select('id, excel_filename, status, total_tasks, completed_tasks, failed_tasks, zip_filename, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // 如果指定了状态过滤
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error('Failed to get excel batch history:', tasksError);
      return res.status(500).json({
        success: false,
        error: 'Failed to get batch history'
      });
    }

    // 获取总数
    let countQuery = supabaseAdmin
      .from('excel_batch_tasks')
      .select('*', { count: 'exact', head: true });

    if (status && typeof status === 'string') {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Failed to get excel batch count:', countError);
      return res.status(500).json({
        success: false,
        error: 'Failed to get batch count'
      });
    }

    const totalPages = Math.ceil((count || 0) / limitNum);

    res.json({
      success: true,
      data: {
        tasks: tasks || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Get excel batch history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;