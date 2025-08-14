import express from 'express';
import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const router = express.Router();

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'inputexcel';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // 只允许Excel文件
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传Excel文件 (.xlsx, .xls)'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 上传Excel文件并创建批处理任务
router.post('/upload', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const { userId } = req.body;
    const batchId = uuidv4();
    const excelFilename = req.file.filename;
    const excelPath = req.file.path;

    // 创建批处理记录
    const { data: batchData, error: batchError } = await supabase
      .from('excel_batch_tasks')
      .insert({
        id: batchId,
        user_id: userId || 'anonymous',
        excel_filename: excelFilename,
        excel_path: excelPath,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (batchError) {
      console.error('创建批处理记录失败:', batchError);
      return res.status(500).json({ success: false, error: '创建批处理记录失败' });
    }

    // 异步启动Python脚本处理
    const outputDir = path.join('downloads', 'excel_batch');
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 启动Python脚本
    const pythonScript = path.join(__dirname, '..', 'python_scripts', 'excel_batch_processor.py');
    const pythonProcess = spawn('python', [pythonScript, excelPath, outputDir, apiBaseUrl], {
      detached: true,
      stdio: 'ignore'
    });

    pythonProcess.unref();

    // 更新状态为处理中
    await supabase
      .from('excel_batch_tasks')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', batchId);

    res.json({
      success: true,
      batchId,
      message: 'Excel文件上传成功，正在后台处理',
      filename: excelFilename
    });

  } catch (error) {
    console.error('Excel上传处理错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取批处理任务状态
router.get('/batch/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;

    const { data, error } = await supabase
      .from('excel_batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: '批处理任务不存在' });
    }

    res.json({
      success: true,
      batch: data
    });

  } catch (error) {
    console.error('获取批处理状态错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取用户的批处理历史
router.get('/batches', async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('excel_batch_tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (userId && userId !== 'anonymous') {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('获取批处理历史错误:', error);
      return res.status(500).json({ success: false, error: '获取批处理历史失败' });
    }

    res.json({
      success: true,
      batches: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit)
    });

  } catch (error) {
    console.error('获取批处理历史错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 下载批处理结果ZIP文件
router.get('/batch/:batchId/download', async (req, res) => {
  try {
    const { batchId } = req.params;

    // 获取批处理信息
    const { data, error } = await supabase
      .from('excel_batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: '批处理任务不存在' });
    }

    if (data.status !== 'completed' || !data.zip_path) {
      return res.status(400).json({ success: false, error: 'ZIP文件尚未生成或任务未完成' });
    }

    const zipPath = data.zip_path;
    
    // 检查文件是否存在
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, error: 'ZIP文件不存在' });
    }

    // 设置响应头
    const filename = path.basename(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // 流式传输文件
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('文件流错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: '文件下载失败' });
      }
    });

  } catch (error) {
    console.error('下载ZIP文件错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '服务器内部错误' });
    }
  }
});

// 删除批处理任务
router.delete('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    // 获取批处理信息
    const { data, error: fetchError } = await supabase
      .from('excel_batch_tasks')
      .select('*')
      .eq('id', batchId)
      .single();

    if (fetchError || !data) {
      return res.status(404).json({ success: false, error: '批处理任务不存在' });
    }

    // 删除相关文件
    try {
      if (data.excel_path && fs.existsSync(data.excel_path)) {
        fs.unlinkSync(data.excel_path);
      }
      if (data.zip_path && fs.existsSync(data.zip_path)) {
        fs.unlinkSync(data.zip_path);
      }
    } catch (fileError) {
      console.warn('删除文件时出错:', fileError);
    }

    // 删除数据库记录
    const { error: deleteError } = await supabase
      .from('excel_batch_tasks')
      .delete()
      .eq('id', batchId);

    if (deleteError) {
      console.error('删除批处理记录失败:', deleteError);
      return res.status(500).json({ success: false, error: '删除批处理记录失败' });
    }

    res.json({ success: true, message: '批处理任务已删除' });

  } catch (error) {
    console.error('删除批处理任务错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

export default router;
