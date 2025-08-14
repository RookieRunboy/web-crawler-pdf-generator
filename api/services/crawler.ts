import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// 使用stealth插件
puppeteer.use(StealthPlugin());
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
  private pagePool: Page[] = [];
  private maxPoolSize: number = 5;
  private currentPoolSize: number = 0;
  private browserHealthy: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30秒

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        console.log('Initializing browser with enhanced stability configuration...');
        this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-features=TranslateUI',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        timeout: 60000,
      });
        console.log('Browser initialized successfully');
      } catch (error) {
        console.error('Failed to initialize browser:', error);
        this.browser = null;
        throw new Error(`Browser initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async closeBrowser(): Promise<void> {
    // 关闭所有页面池中的页面
    for (const page of this.pagePool) {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        console.error('Error closing pooled page:', error);
      }
    }
    this.pagePool = [];
    this.currentPoolSize = 0;
    
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.browser = null;
    }
    this.browserHealthy = true;
  }

  // 页面池管理
  private async getPageFromPool(): Promise<Page> {
    // 检查浏览器健康状态
    await this.checkBrowserHealth();
    
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      try {
        // 检查页面是否仍然有效
        if (!page.isClosed()) {
          return page;
        }
      } catch (error) {
        console.warn('Page from pool is invalid, creating new one');
      }
    }
    
    // 创建新页面
    if (!this.browser) {
      await this.initBrowser();
    }
    
    const page = await this.browser!.newPage();
    this.currentPoolSize++;
    return page;
  }

  // 将页面返回到池中
  private async returnPageToPool(page: Page): Promise<void> {
    try {
      if (page.isClosed()) {
        this.currentPoolSize--;
        return;
      }
      
      // 清理页面状态
      await page.goto('about:blank');
      
      if (this.pagePool.length < this.maxPoolSize) {
        this.pagePool.push(page);
      } else {
        // 池已满，关闭页面
        await page.close();
        this.currentPoolSize--;
      }
    } catch (error) {
      console.error('Error returning page to pool:', error);
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
      this.currentPoolSize--;
    }
  }

  // 检查浏览器健康状态
  private async checkBrowserHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }
    
    this.lastHealthCheck = now;
    
    if (!this.browser) {
      this.browserHealthy = false;
      return;
    }
    
    try {
      // 尝试获取浏览器版本来检查连接
      await this.browser.version();
      this.browserHealthy = true;
    } catch (error) {
      console.warn('Browser health check failed, will reinitialize:', error);
      this.browserHealthy = false;
      
      // 尝试重新初始化浏览器
      try {
        await this.closeBrowser();
        await this.initBrowser();
        this.browserHealthy = true;
      } catch (reinitError) {
        console.error('Failed to reinitialize browser:', reinitError);
      }
    }
  }

  // 提取主要内容的方法
  private extractMainContent($: cheerio.CheerioAPI, url: string): string {
    // 移除不相关的元素
    this.removeIrrelevantElements($);
    
    // 尝试找到语义化的主要内容
    let mainContent = this.findSemanticContent($);
    
    // 如果没有找到语义化内容，使用内容密度算法
    if (!mainContent) {
      mainContent = this.findContentByDensity($);
    }
    
    if (mainContent && mainContent.length > 0) {
      return this.cleanAndEvaluateContentAsHTML($, mainContent);
    }
    
    // 最后的回退方案
    return $('body').text().trim();
  }

  private removeIrrelevantElements($: cheerio.CheerioAPI): void {
    // 移除脚本、样式、导航等不相关元素
    $('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social, .share, .comment, .comments, #comments, .related, .recommended, .popup, .modal, .overlay, .banner, .promotion, .newsletter, .subscription, .cookie, .gdpr, .privacy, .terms, .legal, .disclaimer, .copyright, .breadcrumb, .pagination, .tags, .categories, .metadata, .author-info, .date-info, .share-buttons, .social-media, .external-links, .sponsored, .affiliate, .tracking, .analytics, .pixel, .beacon, .widget, .plugin, .embed, .iframe, .video-player, .audio-player, .gallery, .slideshow, .carousel, .tabs, .accordion, .dropdown, .tooltip, .popover, .alert, .notification, .message, .error, .warning, .success, .info, .debug, .log, .console, .admin, .dashboard, .control, .setting, .config, .option, .preference, .profile, .account, .login, .register, .signup, .signin, .logout, .password, .forgot, .reset, .verify, .confirm, .activate, .deactivate, .enable, .disable, .on, .off, .yes, .no, .ok, .cancel, .close, .exit, .quit, .back, .forward, .next, .previous, .first, .last, .top, .bottom, .left, .right, .center, .middle, .start, .end, .begin, .finish, .complete, .done, .todo, .pending, .waiting, .loading, .spinner, .progress, .status, .state, .flag, .badge, .label, .tag, .chip, .pill, .button, .btn, .link, .anchor, .url, .href, .src, .alt, .title, .caption, .description, .summary, .abstract, .excerpt, .preview, .thumbnail, .image, .img, .picture, .photo, .graphic, .icon, .symbol, .logo, .brand, .trademark, .copyright, .license, .patent, .trademark, .registered, .reserved, .protected, .confidential, .private, .public, .internal, .external, .local, .remote, .global, .universal, .international, .national, .regional, .local, .domestic, .foreign, .overseas, .abroad, .international, .worldwide, .global, .universal, .general, .specific, .particular, .special, .unique, .individual, .personal, .custom, .default, .standard, .normal, .regular, .common, .typical, .usual, .ordinary, .average, .medium, .middle, .center, .central, .main, .primary, .secondary, .tertiary, .quaternary, .quinary, .senary, .septenary, .octonary, .nonary, .denary').remove();
    
    // 移除隐藏元素
    $('[style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]').remove();
    
    // 移除空的或只包含空白字符的元素
    $('*').each((_, element) => {
      const $el = $(element);
      if ($el.children().length === 0 && $el.text().trim() === '') {
        $el.remove();
      }
    });
  }

  private findSemanticContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    // 按优先级查找语义化内容容器
    const semanticSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.page-content',
      '#main-content',
      '#content',
      '#post-content',
      '#article-content',
      '#entry-content',
      '#page-content'
    ];
    
    for (const selector of semanticSelectors) {
      const element = $(selector).first();
      if (element.length > 0 && this.hasSignificantContent(element)) {
        return element;
      }
    }
    
    return null;
  }

  private findContentByDensity($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    let bestElement: cheerio.Cheerio<any> | null = null;
    let bestScore = 0;
    
    // 检查所有可能的内容容器
    $('div, section, article, main').each((_, element) => {
      const $element = $(element);
      const score = this.calculateContentScore($element);
      
      if (score > bestScore && this.hasSignificantContent($element)) {
        bestScore = score;
        bestElement = $element;
      }
    });
    
    return bestElement;
  }

  private calculateContentScore($element: cheerio.Cheerio<any>): number {
    const text = $element.text();
    const textLength = text.length;
    const childrenCount = $element.children().length;
    const linkDensity = $element.find('a').length / Math.max(textLength / 100, 1);
    
    // 基础分数基于文本长度
    let score = textLength;
    
    // 减少链接密度高的元素的分数
    score -= linkDensity * 50;
    
    // 增加包含段落的元素的分数
    const paragraphs = $element.find('p').length;
    score += paragraphs * 25;
    
    // 减少嵌套过深的元素的分数
    const depth = $element.parents().length;
    score -= depth * 5;
    
    // 增加包含标题的元素的分数
    const headings = $element.find('h1, h2, h3, h4, h5, h6').length;
    score += headings * 30;
    
    // 减少包含太多子元素的分数（可能是导航或侧边栏）
    if (childrenCount > 20) {
      score -= childrenCount * 2;
    }
    
    return Math.max(0, score);
  }

  private hasSignificantContent($element: cheerio.Cheerio<any>): boolean {
    const text = $element.text().trim();
    return text.length > 100 && !this.isLikelyIrrelevant(text);
  }

  private cleanAndEvaluateContentAsHTML($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): string {
    // 清理HTML属性
    this.cleanHTMLAttributes($, $element);
    
    // 移除空元素
    this.removeEmptyElements($, $element);
    
    // 返回清理后的HTML
    return $element.html() || '';
  }

  private cleanHTMLAttributes($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): void {
    // 保留的属性列表
    const keepAttributes = ['href', 'src', 'alt', 'title'];
    
    $element.find('*').each((_, el) => {
      const $el = $(el);
      const attributes = Object.keys(el.attribs || {});
      
      attributes.forEach(attr => {
        if (!keepAttributes.includes(attr)) {
          $el.removeAttr(attr);
        }
      });
    });
  }

  private removeEmptyElements($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): void {
    // 移除空的段落、div等
    $element.find('p, div, span, section, article').each((_, el) => {
      const $el = $(el);
      if ($el.children().length === 0 && $el.text().trim() === '') {
        $el.remove();
      }
    });
    
    // 移除只包含空白字符的文本节点
    $element.contents().each((_, node) => {
      if (node.type === 'text' && $(node).text().trim() === '') {
        $(node).remove();
      }
    });
  }

  private isLikelyIrrelevant(text: string): boolean {
    const irrelevantPatterns = [
      /^\s*(登录|注册|登出|退出|菜单|导航|搜索|关于我们|联系我们|版权|隐私|条款|免责声明)\s*$/i,
      /^\s*(login|register|logout|menu|navigation|search|about|contact|copyright|privacy|terms|disclaimer)\s*$/i,
      /^\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*$/,
      /^\s*\d+\s*$/,
      /^\s*[\w\s]*@[\w\s]*\.[\w\s]*\s*$/
    ];
    
    return irrelevantPatterns.some(pattern => pattern.test(text));
  }

  async crawlPage(url: string, settings: CrawlSettings = {}): Promise<CrawlResult> {
    const {
      includeImages = false,
      timeout = 30000,
      waitForSelector,
      userAgent
    } = settings;

    let page: Page | null = null;
    
    try {
      // 验证URL
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
      }

      // 标准化URL
      const normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
      }

      console.log(`Starting crawl for: ${normalizedUrl}`);
      
      // 确保浏览器已初始化
      if (!this.browser || !this.browserHealthy) {
        await this.initBrowser();
      }

      // 从页面池获取页面
      page = await this.getPageFromPool();
      
      // 设置用户代理
      if (userAgent) {
        await page.setUserAgent(userAgent);
      }

      // 设置视口
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // 设置请求拦截以提高性能
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) && !includeImages) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // 导航到页面
      console.log(`Navigating to: ${normalizedUrl}`);
      let response;
      try {
        // 首先尝试快速加载
        response = await page.goto(normalizedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: Math.max(timeout, 20000)
        });
        
        // 等待页面稳定
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (timeoutError) {
        console.warn(`Fast load timeout for ${normalizedUrl}, trying fallback strategy`);
        
        // 回退策略：更宽松的等待条件
        response = await page.goto(normalizedUrl, {
          waitUntil: 'load',
          timeout: Math.max(timeout, 30000)
        });
        
        // 等待页面稳定
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (!response) {
        throw new Error('Failed to get response from page');
      }

      // 检查响应状态
      const status = response.status();
      if (status >= 400) {
        throw new Error(`HTTP ${status}: ${response.statusText()}`);
      }

      // 等待特定选择器（如果指定）
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 10000 });
        } catch (selectorError) {
          console.warn(`Selector ${waitForSelector} not found, continuing anyway`);
        }
      }

      // 等待页面完全加载
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.warn('Network idle timeout, continuing with current state');
      });

      // 获取页面内容
      const content = await page.content();
      const title = await page.title();
      
      console.log(`Successfully loaded page: ${title}`);

      // 使用Cheerio解析HTML
      const $ = cheerio.load(content);
      
      // 提取主要内容
      const mainContent = this.extractMainContent($, normalizedUrl);
      
      // 提取链接
      const links: string[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, normalizedUrl).href;
            links.push(absoluteUrl);
          } catch (urlError) {
            // 忽略无效的URL
          }
        }
      });

      // 提取图片（如果需要）
      const images: string[] = [];
      if (includeImages) {
        $('img[src]').each((_, element) => {
          const src = $(element).attr('src');
          if (src) {
            try {
              const absoluteUrl = new URL(src, normalizedUrl).href;
              images.push(absoluteUrl);
            } catch (urlError) {
              // 忽略无效的URL
            }
          }
        });
      }

      // 将页面返回到池中
      await this.returnPageToPool(page);
      page = null;

      const result: CrawlResult = {
        success: true,
        content: mainContent,
        title: title,
        links: [...new Set(links)], // 去重
        images: includeImages ? [...new Set(images)] : undefined // 去重
      };

      console.log(`Crawl completed successfully for: ${normalizedUrl}`);
      return result;

    } catch (error) {
      console.error(`Crawl failed for ${url}:`, error);
      
      // 确保页面被正确清理
      if (page) {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (closeError) {
          console.error('Error closing page after failure:', closeError);
        }
        this.currentPoolSize--;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // 批量爬取方法
  async crawlMultiplePages(urls: string[], settings: CrawlSettings = {}): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];
    const concurrency = Math.min(3, this.maxPoolSize); // 限制并发数
    
    console.log(`Starting batch crawl for ${urls.length} URLs with concurrency ${concurrency}`);
    
    // 分批处理URL
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(url => this.crawlPage(url, settings));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch crawl failed for ${batch[index]}:`, result.reason);
            results.push({
              success: false,
              error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
            });
          }
        });
        
        // 在批次之间添加延迟以避免过载
        if (i + concurrency < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error('Batch processing error:', error);
        // 为这个批次的所有URL添加失败结果
        batch.forEach(() => {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Batch processing failed'
          });
        });
      }
    }
    
    console.log(`Batch crawl completed. Success: ${results.filter(r => r.success).length}/${results.length}`);
    return results;
  }

  // 清理资源
  async cleanup(): Promise<void> {
    console.log('Cleaning up crawler resources...');
    await this.closeBrowser();
    console.log('Crawler cleanup completed');
  }
}

// 导出单例实例
export const crawlerService = new CrawlerService();

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('Received SIGINT, cleaning up crawler...');
  await crawlerService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, cleaning up crawler...');
  await crawlerService.cleanup();
  process.exit(0);
});
