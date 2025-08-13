import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { supabaseAdmin } from '../config/supabase.js';

export interface CrawlSettings {
  includeImages?: boolean;
  maxPages?: number;
  timeout?: number;
  waitForSelector?: string;
  userAgent?: string;
}

export interface CrawlResult {
  success: boolean;
  content?: string;
  title?: string;
  images?: string[];
  links?: string[];
  error?: string;
}

class CrawlerService {
  private browser: Browser | null = null;

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

  async crawlPage(url: string, settings: CrawlSettings = {}): Promise<CrawlResult> {
    const {
      includeImages = true,
      timeout = 30000,
      waitForSelector,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    } = settings;

    let page: Page | null = null;

    try {
      await this.initBrowser();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      page = await this.browser.newPage();
      
      // 设置用户代理
      await page.setUserAgent(userAgent);
      
      // 设置视口
      await page.setViewport({ width: 1920, height: 1080 });
      
      // 设置超时
      page.setDefaultTimeout(timeout);
      
      // 拦截不必要的资源以提高性能
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (!includeImages && (resourceType === 'image' || resourceType === 'media')) {
          req.abort();
        } else if (resourceType === 'font' || resourceType === 'stylesheet') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 导航到页面
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // 改为更快的等待条件
        timeout: Math.max(timeout, 15000) // 确保至少15秒超时
      });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load page: ${response?.status()} ${response?.statusText()}`);
      }

      // 等待特定选择器（如果指定）
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }

      // 获取页面内容
      const html = await page.content();
      const title = await page.title();
      
      // 使用Cheerio解析HTML
      const $ = cheerio.load(html);
      
      // 清理和提取文本内容
      $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
      
      const content = $('body').text().replace(/\s+/g, ' ').trim();
      
      // 提取图片链接
      const images: string[] = [];
      if (includeImages) {
        $('img').each((_, element) => {
          const src = $(element).attr('src');
          if (src) {
            // 转换相对URL为绝对URL
            const absoluteUrl = new URL(src, url).href;
            images.push(absoluteUrl);
          }
        });
      }
      
      // 提取链接
      const links: string[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith('http')) {
          links.push(href);
        }
      });

      return {
        success: true,
        content,
        title,
        images: images.slice(0, 50), // 限制图片数量
        links: links.slice(0, 100)   // 限制链接数量
      };

    } catch (error) {
      console.error('Crawl error:', error);
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

  async updateTaskStatus(taskId: string, status: string, error?: string): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (error) {
        updateData.error_message = error;
      }

      const { error: updateError } = await supabaseAdmin
        .from('scrape_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (updateError) {
        console.error('Failed to update task status:', updateError);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  }

  async saveResult(taskId: string, result: CrawlResult): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('scrape_results')
        .insert({
          task_id: taskId,
          content: result.content || null,
          error_message: result.error || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to save result:', error);
      }
    } catch (error) {
      console.error('Error saving result:', error);
    }
  }

  async processCrawlTask(taskId: string, url: string, settings: CrawlSettings = {}): Promise<void> {
    try {
      // 更新任务状态为处理中
      await this.updateTaskStatus(taskId, 'processing');
      
      // 执行爬取
      const result = await this.crawlPage(url, settings);
      
      // 保存结果
      await this.saveResult(taskId, result);
      
      // 更新任务状态
      if (result.success) {
        await this.updateTaskStatus(taskId, 'completed');
      } else {
        await this.updateTaskStatus(taskId, 'failed', result.error);
      }
    } catch (error) {
      console.error('Error processing crawl task:', error);
      await this.updateTaskStatus(taskId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

export const crawlerService = new CrawlerService();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('Closing browser...');
  await crawlerService.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing browser...');
  await crawlerService.closeBrowser();
  process.exit(0);
});