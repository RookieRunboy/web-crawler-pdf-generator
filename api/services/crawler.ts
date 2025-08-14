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
  private maxPoolSize: number = 20; // 增加页面池大小
  private currentPoolSize: number = 0;
  private browserHealthy: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30秒
  private browserStartTime: number = 0;
  private browserRestartInterval: number = 3600000; // 1小时重启一次
  private memoryUsage: { rss: number; heapUsed: number; heapTotal: number } = { rss: 0, heapUsed: 0, heapTotal: 0 };
  private lastMemoryCheck: number = 0;
  private memoryCheckInterval: number = 60000; // 1分钟检查一次内存

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        console.log('Initializing browser with enhanced stability configuration...');
        this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--enable-gpu-rasterization', // 启用GPU光栅化加速
          '--enable-zero-copy', // 启用零拷贝优化
          '--use-gl=angle', // 使用ANGLE OpenGL实现
          '--no-first-run',
          '--disable-features=TranslateUI',
          '--max-old-space-size=6144', // 增加Node.js堆内存限制至6GB（M4优化）
          '--memory-pressure-off', // 关闭内存压力检测
          '--disable-background-timer-throttling', // 禁用后台定时器节流
          '--disable-backgrounding-occluded-windows', // 禁用遮挡窗口的后台处理
          '--disable-renderer-backgrounding', // 禁用渲染器后台处理
          '--disable-features=VizDisplayCompositor', // 禁用显示合成器
          '--disable-ipc-flooding-protection', // 禁用IPC洪水保护
          '--disable-background-networking', // 禁用后台网络
          '--disable-default-apps', // 禁用默认应用
          '--disable-extensions', // 禁用扩展
          '--disable-sync', // 禁用同步
          '--disable-translate', // 禁用翻译
          '--disable-web-security', // 禁用Web安全（仅用于爬虫）
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        timeout: 90000, // 增加超时时间
      });
        this.browserStartTime = Date.now();
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

  /**
   * 从页面池获取页面，如果池为空则创建新页面
   */
  private async getPageFromPool(): Promise<Page> {
    // 健康检查
    await this.checkBrowserHealth();
    
    // 尝试从池中获取可用页面
    while (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      try {
        if (!page.isClosed()) {
          // 重置页面状态，使用更彻底的清理
          await this.resetPageState(page);
          return page;
        }
      } catch (error) {
        console.warn('Pooled page is unusable, discarding:', error);
        this.currentPoolSize--;
      }
    }
    
    // 池中没有可用页面，创建新页面
    if (!this.browser) {
      await this.initBrowser();
    }
    
    if (!this.browser) {
      throw new Error('Browser not available');
    }
    
    const page = await this.browser.newPage();
    
    // 配置新页面的性能优化设置
    await this.configurePageForPerformance(page);
    
    this.currentPoolSize++;
    console.log(`Created new page, pool size: ${this.currentPoolSize}`);
    return page;
  }

  /**
   * 将页面返回到池中
   */
  private async returnPageToPool(page: Page): Promise<void> {
    try {
      if (page.isClosed()) {
        this.currentPoolSize--;
        return;
      }
      
      // 如果池已满，关闭最旧的页面
      if (this.pagePool.length >= this.maxPoolSize) {
        const oldPage = this.pagePool.shift(); // 移除最旧的页面
        if (oldPage && !oldPage.isClosed()) {
          await oldPage.close();
        }
        this.currentPoolSize--;
      }
      
      // 清理页面状态
      try {
        await this.resetPageState(page);
        
        // 返回到池中
        this.pagePool.push(page);
        console.log(`Returned page to pool, pool size: ${this.pagePool.length}`);
      } catch (resetError) {
        console.warn('Failed to reset page state, closing page:', resetError);
        await page.close();
        this.currentPoolSize--;
      }
    } catch (error) {
      console.error('Error returning page to pool:', error);
      try {
        await page.close();
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
      this.currentPoolSize--;
    }
  }

  /**
   * 重置页面状态
   */
  private async resetPageState(page: Page): Promise<void> {
    try {
      // 停止所有网络请求
      await page.setRequestInterception(false);
      
      // 移除所有监听器
      await page.removeAllListeners();
      
      // 清理页面内容
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
      
      // 清理页面缓存
      await page.evaluate(() => {
        // 清理本地存储
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }
        // 清理页面变量
        if (typeof window !== 'undefined') {
          // @ts-ignore
          window.stop && window.stop();
        }
      });
      
    } catch (error) {
      console.warn('Error resetting page state:', error);
      throw error;
    }
  }

  /**
   * 配置页面性能优化设置
   */
  private async configurePageForPerformance(page: Page): Promise<void> {
    try {
      // 设置用户代理
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 设置视口
      await page.setViewport({ width: 1920, height: 1080 });
      
      // 禁用图片和CSS加载以提高性能（可选）
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // 设置额外的HTTP头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      
    } catch (error) {
      console.warn('Error configuring page for performance:', error);
    }
  }

  /**
   * 检查浏览器健康状态
   */
  private async checkBrowserHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }
    
    this.lastHealthCheck = now;
    
    // 检查内存使用情况
    await this.checkMemoryUsage();
    
    // 检查是否需要定期重启浏览器
    if (this.browserStartTime > 0 && now - this.browserStartTime > this.browserRestartInterval) {
      console.log('Browser restart interval reached, restarting browser...');
      await this.restartBrowser();
      return;
    }
    
    if (!this.browser) {
      this.browserHealthy = false;
      return;
    }
    
    try {
      // 简单的健康检查：获取浏览器版本
      await this.browser.version();
      this.browserHealthy = true;
    } catch (error) {
      console.warn('Browser health check failed:', error);
      this.browserHealthy = false;
      
      // 重新初始化浏览器
      try {
        await this.restartBrowser();
      } catch (reinitError) {
        console.error('Failed to reinitialize browser:', reinitError);
      }
    }
  }

  /**
   * 检查内存使用情况
   */
  private async checkMemoryUsage(): Promise<void> {
    const now = Date.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return;
    }
    
    this.lastMemoryCheck = now;
    
    try {
      const memUsage = process.memoryUsage();
      this.memoryUsage = {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      };
      
      const rssInMB = Math.round(memUsage.rss / 1024 / 1024);
      const heapUsedInMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalInMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      
      console.log(`Memory usage - RSS: ${rssInMB}MB, Heap Used: ${heapUsedInMB}MB, Heap Total: ${heapTotalInMB}MB, Pool Size: ${this.pagePool.length}`);
      
      // 如果内存使用过高，触发清理
      if (rssInMB > 2048 || heapUsedInMB > 1536) { // RSS > 2GB 或 Heap > 1.5GB
        console.warn('High memory usage detected, triggering cleanup...');
        await this.performMemoryCleanup();
      }
    } catch (error) {
      console.error('Error checking memory usage:', error);
    }
  }

  /**
   * 执行内存清理
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      // 清理页面池中的一半页面
      const pagesToClose = Math.ceil(this.pagePool.length / 2);
      for (let i = 0; i < pagesToClose; i++) {
        const page = this.pagePool.pop();
        if (page && !page.isClosed()) {
          await page.close();
          this.currentPoolSize--;
        }
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        console.log('Forced garbage collection completed');
      }
      
      console.log(`Memory cleanup completed, remaining pool size: ${this.pagePool.length}`);
    } catch (error) {
      console.error('Error during memory cleanup:', error);
    }
  }

  /**
   * 重启浏览器
   */
  private async restartBrowser(): Promise<void> {
    try {
      console.log('Restarting browser for better stability...');
      await this.closeBrowser();
      await this.initBrowser();
      console.log('Browser restarted successfully');
    } catch (error) {
      console.error('Failed to restart browser:', error);
      throw error;
    }
  }

  /**
   * 使用混合策略提取网页正文内容
   * @param $ Cheerio实例
   * @param url 页面URL
   * @returns 提取的正文HTML内容
   */
  private extractMainContent($: cheerio.CheerioAPI, url: string): string {
    // 1. 增强选择器过滤 - 移除无关元素
    this.removeIrrelevantElements($);
    
    // 2. 语义化标签识别 - 优先查找语义化容器
    let mainContent = this.findSemanticContent($);
    
    // 3. 如果没有找到语义化标签，使用文本密度算法
    if (!mainContent) {
      mainContent = this.findContentByDensity($);
    }
    
    // 4. 内容质量评估和清理，返回HTML结构
    return this.cleanAndEvaluateContentAsHTML($, mainContent || $('body'));
  }

  /**
   * 移除无关元素
   */
  private removeIrrelevantElements($: cheerio.CheerioAPI): void {
    // 基础无关元素
    const irrelevantSelectors = [
      'script', 'style', 'noscript', 'iframe',
      // 导航相关
      'nav', 'header', 'footer', '.navbar', '.navigation', '.nav',
      // 侧边栏
      'aside', '.sidebar', '.side-bar', '.widget', '.widgets',
      // 广告相关
      '.advertisement', '.ads', '.ad', '.advert', '.banner',
      '.sponsored', '.promotion', '.promo',
      // 评论和社交
      '.comments', '.comment', '.social', '.share', '.sharing',
      // 推荐和相关
      '.related', '.recommended', '.suggestions', '.more-stories',
      // 其他无关内容
      '.breadcrumb', '.breadcrumbs', '.tags', '.tag-list',
      '.author-info', '.author-bio', '.meta', '.metadata',
      '.popup', '.modal', '.overlay', '.cookie-notice',
      // 常见的无关class和id
      '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',
      '[class*="sidebar"]', '[class*="widget"]', '[class*="banner"]'
    ];
    
    irrelevantSelectors.forEach(selector => {
      $(selector).remove();
    });
  }

  /**
   * 查找语义化内容容器
   */
  private findSemanticContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    // 按优先级查找语义化标签
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.main-content',
      '.post-body',
      '.article-body'
    ];
    
    for (const selector of semanticSelectors) {
      const element = $(selector).first();
      if (element.length > 0 && this.hasSignificantContent(element)) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * 基于文本密度算法查找主要内容
   */
  private findContentByDensity($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    let bestElement: cheerio.Cheerio<any> | null = null;
    let bestScore = 0;
    
    // 遍历可能包含主要内容的元素
    $('div, section, article').each((_, element) => {
      const $element = $(element);
      const score = this.calculateContentScore($element);
      
      if (score > bestScore) {
        bestScore = score;
        bestElement = $element;
      }
    });
    
    return bestElement && bestScore > 50 ? bestElement : null;
  }

  /**
   * 计算元素的内容得分
   */
  private calculateContentScore($element: cheerio.Cheerio<any>): number {
    const text = $element.text().trim();
    const textLength = text.length;
    
    if (textLength < 100) return 0;
    
    // 基础分数：文本长度
    let score = textLength;
    
    // 段落数量加分
    const paragraphs = $element.find('p').length;
    score += paragraphs * 20;
    
    // 链接密度惩罚（链接过多可能是导航或推荐区域）
    const links = $element.find('a').length;
    const linkDensity = links / Math.max(paragraphs, 1);
    if (linkDensity > 0.5) {
      score *= 0.5;
    }
    
    // 图片加分
    const images = $element.find('img').length;
    score += images * 10;
    
    // 标题加分
    const headings = $element.find('h1, h2, h3, h4, h5, h6').length;
    score += headings * 15;
    
    return score;
  }

  /**
   * 检查元素是否包含有意义的内容
   */
  private hasSignificantContent($element: cheerio.Cheerio<any>): boolean {
    const text = $element.text().trim();
    return text.length > 100 && $element.find('p').length > 0;
  }

  /**
   * 清理和评估内容质量，返回HTML结构
   */
  private cleanAndEvaluateContentAsHTML($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): string {
    // 移除剩余的无关元素
    $element.find('script, style, .ad, .ads').remove();
    
    // 保留重要的HTML标签，移除其他属性
    this.cleanHTMLAttributes($, $element);
    
    // 移除空的段落和无意义的元素
    this.removeEmptyElements($, $element);
    
    // 返回清理后的HTML内容
    return $element.html() || '';
  }

  /**
   * 清理HTML属性，只保留安全的属性
   */
  private cleanHTMLAttributes($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): void {
    // 保留的标签和它们允许的属性
    const allowedTags = {
      'p': [],
      'h1': [], 'h2': [], 'h3': [], 'h4': [], 'h5': [], 'h6': [],
      'ul': [], 'ol': [], 'li': [],
      'strong': [], 'b': [], 'em': [], 'i': [],
      'br': [], 'hr': [],
      'blockquote': [],
      'div': [], 'span': [],
      'a': ['href'],
      'img': ['src', 'alt']
    };

    $element.find('*').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName?.toLowerCase();
      
      if (tagName && allowedTags[tagName as keyof typeof allowedTags]) {
        // 移除不允许的属性
        const allowedAttrs = allowedTags[tagName as keyof typeof allowedTags];
        const attrs = $el.get(0)?.attribs || {};
        
        Object.keys(attrs).forEach(attr => {
          if (!allowedAttrs.includes(attr)) {
            $el.removeAttr(attr);
          }
        });
      } else if (tagName && !allowedTags[tagName as keyof typeof allowedTags]) {
        // 不在允许列表中的标签，保留内容但移除标签
        $el.replaceWith($el.html() || '');
      }
    });
  }

  /**
   * 移除空的元素
   */
  private removeEmptyElements($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): void {
    // 移除空的段落和标题
    $element.find('p, h1, h2, h3, h4, h5, h6, div').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      
      if (text.length === 0 || this.isLikelyIrrelevant(text)) {
        $el.remove();
      }
    });
    
    // 移除连续的空行
    let html = $element.html() || '';
    html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    $element.html(html);
  }

  /**
   * 判断文本行是否可能是无关信息
   */
  private isLikelyIrrelevant(text: string): boolean {
    const irrelevantPatterns = [
      /^(广告|Advertisement|Sponsored|推广)$/i,
      /^(分享|Share|关注|Follow)$/i,
      /^(更多|More|相关|Related)$/i,
      /^(登录|Login|注册|Register)$/i,
      /^\d+$/, // 纯数字
      /^[\s\W]*$/ // 只包含空白和标点
    ];
    
    return irrelevantPatterns.some(pattern => pattern.test(text));
  }

  async crawlPage(url: string, settings: CrawlSettings = {}): Promise<CrawlResult> {
    const {
      includeImages = true,
      timeout = 30000,
      waitForSelector,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    } = settings;

    // 重试配置
    const maxRetries = 3;
    const retryDelay = 2000; // 2秒
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let page: Page | null = null;
      
      try {
        console.log(`Crawling attempt ${attempt}/${maxRetries} for URL: ${url}`);
        
        // 使用页面池获取页面
        page = await this.getPageFromPool();
      
      // 设置更真实的用户代理和浏览器标识
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 设置额外的浏览器标识头
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // 设置视口
      await page.setViewport({ width: 1920, height: 1080 });
      
      // 设置页面超时
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(30000);
      
      // 增强反检测措施
      await page.evaluateOnNewDocument(() => {
        // 隐藏webdriver属性
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // 删除webdriver相关属性
        try {
          // @ts-ignore
          delete navigator.__proto__.webdriver;
        } catch (e) {
          // 忽略删除失败
        }
        
        // 修改plugins为真实的插件列表
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            return {
              0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              2: { name: 'Native Client', filename: 'internal-nacl-plugin' },
              length: 3
            };
          },
        });
        
        // 修改languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['zh-CN', 'zh', 'en-US', 'en'],
        });
        
        // 设置真实的chrome对象
        // @ts-ignore
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined
          },
          app: {
            isInstalled: false
          }
        };
        
        // 修改权限查询
        const originalQuery = window.navigator.permissions.query;
        // @ts-ignore
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // 隐藏自动化痕迹
        Object.defineProperty(navigator, 'platform', {
          get: () => 'MacIntel',
        });
        
        // 模拟真实的屏幕信息
        Object.defineProperty(screen, 'width', {
          get: () => 1920,
        });
        Object.defineProperty(screen, 'height', {
          get: () => 1080,
        });
        
        // 隐藏Puppeteer痕迹
        const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
        if (originalDescriptor) {
          try {
            // @ts-ignore
            delete Navigator.prototype.webdriver;
          } catch (e) {
            // 忽略删除失败
          }
        }
      });
      
      // 完全禁用请求拦截以避免ERR_BLOCKED_BY_CLIENT错误
      // 这个错误通常是由于网站的反爬虫机制导致的
      await page.setRequestInterception(false);
      
      page.on('requestfailed', (request) => {
        console.log('请求失败:', request.url(), request.failure()?.errorText);
      });

      // 添加随机延迟以模拟人类行为
      const randomDelay = Math.floor(Math.random() * 3000) + 1000; // 1-4秒随机延迟
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // 智能导航策略
      let response;
      try {
        // 首先尝试快速加载
        response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: Math.max(timeout, 20000)
        });
        
        // 等待页面稳定
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (timeoutError) {
        console.warn(`Fast load timeout for ${url}, trying fallback strategy`);
        
        // 回退策略：更宽松的等待条件
        response = await page.goto(url, {
          waitUntil: 'load',
          timeout: Math.max(timeout, 30000)
        });
        
        // 等待页面稳定
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

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
      
      // 使用混合策略提取正文内容
      const content = this.extractMainContent($, url);
      
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

        // 将页面返回到池中
        if (page) {
          await this.returnPageToPool(page);
        }
        
        return {
          success: true,
          content,
          title,
          images: images.slice(0, 50), // 限制图片数量
          links: links.slice(0, 100)   // 限制链接数量
        };

      } catch (error) {
        console.error(`Crawl error on attempt ${attempt}:`, error);
        
        // 清理页面 - 如果是连接错误，不返回到池中
        if (page) {
          const errorMessage = error instanceof Error ? error.message : '';
          const isConnectionError = errorMessage.includes('Protocol error') || 
                                  errorMessage.includes('Connection closed') ||
                                  errorMessage.includes('Target closed') ||
                                  errorMessage.includes('Session closed');
          
          if (isConnectionError) {
            // 连接错误时直接关闭页面，不返回池中
            try {
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (closeError) {
              console.error('Error closing page:', closeError);
            }
            this.currentPoolSize--;
          } else {
            // 其他错误时返回到池中
            await this.returnPageToPool(page);
          }
        }
        
        // 如果是最后一次尝试，返回错误
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
        
        // 检查是否是连接相关错误，如果是则重试
        const errorMessage = error instanceof Error ? error.message : '';
        const isRetryableError = (
          errorMessage.includes('Protocol error') ||
          errorMessage.includes('Connection closed') ||
          errorMessage.includes('Target closed') ||
          errorMessage.includes('Session closed') ||
          errorMessage.includes('Navigation timeout') ||
          errorMessage.includes('net::ERR_') ||
          errorMessage.includes('TimeoutError')
        );
        
        if (!isRetryableError) {
          return {
            success: false,
            error: errorMessage
          };
        }
        
        console.log(`Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        
        // 强制关闭浏览器实例以确保干净的重试
        if (this.browser) {
          try {
            await this.browser.close();
            this.browser = null;
          } catch (closeError) {
            console.error('Error closing browser:', closeError);
          }
        }
        
        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        
      } finally {
        // finally块中不需要处理页面，因为已经在try和catch中处理了
      }
    }
    
    // 如果所有重试都失败了，返回通用错误
    return {
      success: false,
      error: 'All retry attempts failed'
    };
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