import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { robotsService } from './robotsService';
import { supabaseAdmin } from '../config/supabase';

export interface CrawlSettings {
  includeImages?: boolean;
  timeout?: number;
  userAgent?: string;
  maxRetries?: number;
  retryDelay?: number;
  followRedirects?: boolean;
}

export interface CrawlResult {
  success: boolean;
  content?: string;
  title?: string;
  images?: string[];
  links?: string[];
  error?: string;
  statusCode?: number;
  responseTime?: number;
}

class HttpCrawlerService {
  private userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private getRealisticHeaders(url: string, userAgent: string): Record<string, string> {
    const urlObj = new URL(url);
    
    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Referer': urlObj.origin
    };
  }

  /**
   * 提取页面主要内容
   */
  private extractMainContent($: cheerio.CheerioAPI, url: string): string {
    // 移除不需要的元素
    $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ad, .ads, .advertisement').remove();
    $('[class*="ad"], [id*="ad"], [class*="banner"], [id*="banner"]').remove();
    $('[class*="menu"], [id*="menu"], [class*="nav"], [id*="nav"]').remove();
    
    // 尝试多种策略提取主要内容
    let mainContent = this.findContentBySemantic($) || 
                     this.findContentByDensity($) || 
                     this.findContentByFallback($);
    
    if (!mainContent || !this.hasSignificantContent(mainContent)) {
      // 如果没有找到合适的内容，返回body的文本内容
      return $('body').text().trim().substring(0, 10000);
    }
    
    return this.cleanAndEvaluateContentAsHTML($, mainContent);
  }

  /**
   * 基于语义标签查找主要内容
   */
  private findContentBySemantic($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    const semanticSelectors = [
      'article',
      '[role="article"]',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.main-content',
      '.post-body',
      '.article-body',
      '.text-content',
      '.page-content'
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
    $('div, section, article, .content, .main, .body').each((_, element) => {
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
   * 回退策略：查找包含最多文本的元素
   */
  private findContentByFallback($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
    let bestElement: cheerio.Cheerio<any> | null = null;
    let maxTextLength = 0;
    
    $('div, section, article').each((_, element) => {
      const $element = $(element);
      const textLength = $element.text().trim().length;
      
      if (textLength > maxTextLength && textLength > 200) {
        maxTextLength = textLength;
        bestElement = $element;
      }
    });
    
    return bestElement;
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
    
    // 中文内容加分
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    score += chineseCharCount * 2;
    
    return score;
  }

  /**
   * 检查元素是否包含有意义的内容
   */
  private hasSignificantContent($element: cheerio.Cheerio<any>): boolean {
    const text = $element.text().trim();
    return text.length > 100;
  }

  /**
   * 清理和评估内容质量，返回HTML结构
   */
  private cleanAndEvaluateContentAsHTML($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): string {
    // 移除剩余的无关元素
    $element.find('script, style, .ad, .ads, .advertisement').remove();
    
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
      'img': ['src', 'alt'],
      'table': [], 'tr': [], 'td': [], 'th': [], 'thead': [], 'tbody': []
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
    html = html.replace(/(<br\s*\/?\s*){3,}/gi, '<br><br>');
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

  /**
   * 模拟人类行为的延迟
   */
  private async humanLikeDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4秒随机延迟
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 爬取页面内容
   */
  async crawlPage(url: string, settings: CrawlSettings = {}): Promise<CrawlResult> {
    const {
      includeImages = true,
      timeout = 30000,
      userAgent,
      maxRetries = 3,
      retryDelay = 2000,
      followRedirects = true
    } = settings;

    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`HTTP crawling attempt ${attempt}/${maxRetries} for URL: ${url}`);
        
        // 模拟人类行为延迟
        await this.humanLikeDelay();
        
        // 选择用户代理
        const selectedUserAgent = userAgent || this.getRandomUserAgent();
        
        // 构建请求配置
        const config: AxiosRequestConfig = {
          method: 'GET',
          url,
          timeout,
          headers: this.getRealisticHeaders(url, selectedUserAgent),
          maxRedirects: followRedirects ? 5 : 0,
          validateStatus: (status) => status < 400, // 接受所有小于400的状态码
          responseType: 'arraybuffer', // 使用arraybuffer以便处理编码
          decompress: true // 自动解压gzip等压缩格式
        };

        // 发送请求
        const response = await axios(config);
        const responseTime = Date.now() - startTime;
        
        // 检测编码并转换为字符串
        let html: string;
        const contentType = response.headers['content-type'] || '';
        
        if (contentType.includes('charset=')) {
          const charset = contentType.split('charset=')[1].split(';')[0].trim();
          html = Buffer.from(response.data).toString(charset);
        } else {
          // 默认使用UTF-8，如果失败则尝试GBK
          try {
            html = Buffer.from(response.data).toString('utf-8');
          } catch {
            html = Buffer.from(response.data).toString('gbk');
          }
        }
        
        // 使用Cheerio解析HTML
        const $ = cheerio.load(html);
        
        // 获取页面标题
        const title = $('title').text().trim() || '';
        
        // 提取主要内容
        const content = this.extractMainContent($, url);
        
        // 提取图片链接
        const images: string[] = [];
        if (includeImages) {
          $('img').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
              try {
                // 转换相对URL为绝对URL
                const absoluteUrl = new URL(src, url).href;
                images.push(absoluteUrl);
              } catch {
                // 忽略无效的URL
              }
            }
          });
        }
        
        // 提取链接
        const links: string[] = [];
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            try {
              const absoluteUrl = new URL(href, url).href;
              if (absoluteUrl.startsWith('http')) {
                links.push(absoluteUrl);
              }
            } catch {
              // 忽略无效的URL
            }
          }
        });
        
        return {
          success: true,
          content,
          title,
          images: images.slice(0, 50), // 限制图片数量
          links: links.slice(0, 100),  // 限制链接数量
          statusCode: response.status,
          responseTime
        };
        
      } catch (error) {
        console.error(`HTTP crawl error on attempt ${attempt}:`, error);
        
        // 如果是最后一次尝试，返回错误
        if (attempt === maxRetries) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return {
            success: false,
            error: errorMessage,
            responseTime: Date.now() - startTime
          };
        }
        
        // 检查是否是可重试的错误
        const errorMessage = error instanceof Error ? error.message : '';
        const isRetryableError = (
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('socket hang up') ||
          errorMessage.includes('Network Error')
        );
        
        if (!isRetryableError) {
          return {
            success: false,
            error: errorMessage,
            responseTime: Date.now() - startTime
          };
        }
        
        console.log(`Retrying in ${retryDelay * attempt}ms... (attempt ${attempt + 1}/${maxRetries})`);
        
        // 等待重试延迟（递增延迟）
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    // 如果所有重试都失败了，返回通用错误
    return {
      success: false,
      error: 'All retry attempts failed',
      responseTime: Date.now() - startTime
    };
  }

  /**
   * 更新任务状态
   */
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

  /**
   * 保存爬取结果
   */
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

  /**
   * 处理爬取任务
   */
  async processCrawlTask(taskId: string, url: string, settings: CrawlSettings = {}): Promise<void> {
    try {
      // 更新任务状态为处理中
      await this.updateTaskStatus(taskId, 'processing');
      
      // 检查robots.txt权限
      const userAgent = settings.userAgent || this.getRandomUserAgent();
      const isAllowed = await robotsService.isUrlAllowed(url, userAgent);
      if (!isAllowed) {
        throw new Error(`URL被robots.txt禁止访问: ${url}`);
      }

      // 获取crawl-delay设置
      const crawlDelay = await robotsService.getCrawlDelay(url, userAgent);
      if (crawlDelay > 0) {
        console.log(`遵守robots.txt crawl-delay: ${crawlDelay}ms for ${url}`);
        await new Promise(resolve => setTimeout(resolve, crawlDelay));
      }
      
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

export const httpCrawlerService = new HttpCrawlerService();