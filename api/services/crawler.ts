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