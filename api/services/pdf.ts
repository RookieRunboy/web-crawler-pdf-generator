import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer';
import { supabaseAdmin } from '../config/supabase.js';
import * as fs from 'fs';
import * as path from 'path';

export interface PDFSettings {
  format?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  includeImages?: boolean;
  includeLinks?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

class PDFService {
  private browser: Browser | null = null;
  private outputDir = path.join(process.cwd(), 'temp', 'pdfs');

  constructor() {
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private generateHTML(title: string, content: string, url: string, settings: PDFSettings): string {
    const { includeImages = true, includeLinks = true } = settings;
    
    // 检查content是否已经是HTML格式
    const isHTMLContent = content.includes('<') && content.includes('>');
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        .header {
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .url {
            font-size: 14px;
            color: #666;
            word-break: break-all;
        }
        .content {
            font-size: 16px;
            line-height: 1.8;
        }
        /* 段落样式 */
        .content p {
            margin: 0 0 16px 0;
            text-align: justify;
            text-indent: 2em;
        }
        /* 标题样式 */
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            margin: 24px 0 16px 0;
            font-weight: bold;
            line-height: 1.4;
            page-break-after: avoid;
        }
        .content h1 { font-size: 24px; color: #2c3e50; }
        .content h2 { font-size: 20px; color: #34495e; }
        .content h3 { font-size: 18px; color: #34495e; }
        .content h4 { font-size: 16px; color: #34495e; }
        .content h5 { font-size: 14px; color: #34495e; }
        .content h6 { font-size: 14px; color: #34495e; }
        /* 列表样式 */
        .content ul, .content ol {
            margin: 16px 0;
            padding-left: 2em;
        }
        .content li {
            margin: 8px 0;
            line-height: 1.6;
        }
        /* 引用样式 */
        .content blockquote {
            margin: 16px 0;
            padding: 12px 20px;
            border-left: 4px solid #007bff;
            background-color: #f8f9fa;
            font-style: italic;
        }
        /* 强调样式 */
        .content strong, .content b {
            font-weight: bold;
        }
        .content em, .content i {
            font-style: italic;
        }
        /* 图片样式 */
        .content img {
            max-width: 100%;
            height: auto;
            margin: 16px 0;
            display: block;
        }
        /* 链接样式 */
        .content a {
            color: #007bff;
            text-decoration: underline;
        }
        /* 分隔线样式 */
        .content hr {
            margin: 24px 0;
            border: none;
            border-top: 1px solid #ddd;
        }
        /* 代码样式 */
        .content code {
            background-color: #f1f3f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
        ${!includeImages ? '.content img { display: none; }' : ''}
        ${!includeLinks ? '.content a { color: inherit; text-decoration: none; }' : ''}
        @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
            .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
                page-break-after: avoid;
            }
            .content p {
                orphans: 3;
                widows: 3;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${title}</div>
        <div class="url">来源: ${url}</div>
    </div>
    <div class="content">
        ${isHTMLContent ? content : `<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`}
    </div>
    <div class="footer">
        <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
</body>
</html>
    `;
  }

  async generatePDF(taskId: string, title: string, content: string, url: string, settings: PDFSettings = {}): Promise<PDFGenerationResult> {
    let page: Page | null = null;
    
    try {
      await this.initBrowser();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      page = await this.browser.newPage();
      
      // 生成HTML内容
      const html = this.generateHTML(title, content, url, settings);
      
      // 设置页面内容
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });
      
      // PDF选项
      const pdfOptions: PDFOptions = {
        format: settings.format || 'A4',
        landscape: settings.orientation === 'landscape',
        printBackground: true,
        margin: settings.margin || {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: false
      };
      
      // 生成文件名 - 基于任务标题
      const rawTitle = (title || 'webpage').toString();
      const rawFileName = `${rawTitle}_${taskId.substring(0, 8)}.pdf`;
      
      // 清理文件名，使用与下载时相同的逻辑
      const cleanFileName = rawFileName
        .replace(/[\x00-\x1f\x7f-\xff]/g, '') // 移除所有控制字符和扩展ASCII字符
        .replace(/["\\/:*?<>|\r\n\t\v\f]/g, '_') // 替换文件系统和HTTP不安全字符
        .replace(/[^\w\u4e00-\u9fff._-]/g, '_') // 只保留字母数字、中文、点、下划线、连字符
        .replace(/_{2,}/g, '_') // 合并多个连续下划线
        .replace(/^_+|_+$/g, '') // 移除开头和结尾的下划线
        .trim();
      
      // 确保文件名不为空且长度合理
      const fileName = (cleanFileName && cleanFileName.length > 0) ? 
        cleanFileName.substring(0, 100) : `task_${taskId.substring(0, 8)}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      // 生成PDF
      const pdfBuffer = await page.pdf(pdfOptions);
      
      // 保存文件
      fs.writeFileSync(filePath, pdfBuffer);
      
      return {
        success: true,
        filePath,
        fileName
      };
      
    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async updateTaskWithPDF(taskId: string, filePath: string, fileName: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('scrape_tasks')
        .update({
          pdf_path: filePath,
          pdf_filename: fileName,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) {
        console.error('Failed to update task with PDF info:', error);
      }
    } catch (error) {
      console.error('Error updating task with PDF info:', error);
    }
  }

  async generatePDFForTask(taskId: string): Promise<PDFGenerationResult> {
    try {
      // 获取任务信息
      const { data: task, error: taskError } = await supabaseAdmin
        .from('scrape_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        throw new Error('Task not found');
      }

      // 获取爬取结果
      const { data: result, error: resultError } = await supabaseAdmin
        .from('scrape_results')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (resultError || !result || !result.content) {
        throw new Error('No content found for task');
      }

      // 解析设置
      const settings: PDFSettings = task.settings ? JSON.parse(task.settings) : {};
      
      // 生成PDF
      const pdfResult = await this.generatePDF(
        taskId,
        task.title || 'Untitled',
        result.content,
        task.url,
        settings
      );

      if (pdfResult.success && pdfResult.filePath && pdfResult.fileName) {
        // 更新任务信息
        await this.updateTaskWithPDF(taskId, pdfResult.filePath, pdfResult.fileName);
      }

      return pdfResult;
      
    } catch (error) {
      console.error('Error generating PDF for task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old PDF file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }

  getFilePath(fileName: string): string {
    return path.join(this.outputDir, fileName);
  }

  fileExists(fileName: string): boolean {
    return fs.existsSync(this.getFilePath(fileName));
  }
}

export const pdfService = new PDFService();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('Closing PDF service browser...');
  await pdfService.closeBrowser();
});

process.on('SIGTERM', async () => {
  console.log('Closing PDF service browser...');
  await pdfService.closeBrowser();
});

// 定期清理旧文件
setInterval(() => {
  pdfService.cleanupOldFiles(24);
}, 60 * 60 * 1000); // 每小时检查一次