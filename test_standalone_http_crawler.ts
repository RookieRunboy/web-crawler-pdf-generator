import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

interface CrawlResult {
  success: boolean;
  content?: string;
  title?: string;
  images?: string[];
  links?: string[];
  error?: string;
  statusCode?: number;
  responseTime?: number;
}

class StandaloneHttpCrawler {
  private userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private getRealisticHeaders(url: string, userAgent: string): Record<string, string> {
    const urlObj = new URL(url);
    
    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
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
  private extractMainContent($: cheerio.CheerioAPI): string {
    // 移除不需要的元素
    $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation').remove();
    $('[class*="ad"], [id*="ad"], [class*="banner"], [id*="banner"]').remove();
    $('[class*="menu"], [id*="menu"], [class*="nav"], [id*="nav"]').remove();
    
    // 尝试多种策略提取主要内容
    let mainContent = this.findContentBySemantic($) || 
                     this.findContentByDensity($) || 
                     this.findContentByFallback($);
    
    if (!mainContent) {
      // 如果没有找到合适的内容，返回body的文本内容
      return $('body').text().trim().substring(0, 5000);
    }
    
    return mainContent.html() || mainContent.text().trim();
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
      if (element.length > 0 && element.text().trim().length > 100) {
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
      const text = $element.text().trim();
      const textLength = text.length;
      
      if (textLength < 100) return;
      
      // 基础分数：文本长度
      let score = textLength;
      
      // 段落数量加分
      const paragraphs = $element.find('p').length;
      score += paragraphs * 20;
      
      // 链接密度惩罚
      const links = $element.find('a').length;
      const linkDensity = links / Math.max(paragraphs, 1);
      if (linkDensity > 0.5) {
        score *= 0.5;
      }
      
      // 中文内容加分
      const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      score += chineseCharCount * 2;
      
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
   * 模拟人类行为的延迟
   */
  private async humanLikeDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 2000) + 500; // 0.5-2.5秒随机延迟
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 爬取页面内容
   */
  async crawlPage(url: string): Promise<CrawlResult> {
    const maxRetries = 3;
    const retryDelay = 2000;
    const timeout = 30000;
    
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`HTTP爬取尝试 ${attempt}/${maxRetries}: ${url}`);
        
        // 模拟人类行为延迟
        await this.humanLikeDelay();
        
        // 选择用户代理
        const selectedUserAgent = this.getRandomUserAgent();
        console.log(`使用User-Agent: ${selectedUserAgent.substring(0, 50)}...`);
        
        // 构建请求配置
        const config: AxiosRequestConfig = {
          method: 'GET',
          url,
          timeout,
          headers: this.getRealisticHeaders(url, selectedUserAgent),
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          responseType: 'arraybuffer',
          decompress: true
        };

        // 发送请求
        console.log('发送HTTP请求...');
        const response = await axios(config);
        const responseTime = Date.now() - startTime;
        
        console.log(`响应状态: ${response.status} ${response.statusText}`);
        console.log(`响应时间: ${responseTime}ms`);
        
        // 检测编码并转换为字符串
        let html: string;
        const contentType = response.headers['content-type'] || '';
        console.log(`Content-Type: ${contentType}`);
        
        if (contentType.includes('charset=')) {
          const charset = contentType.split('charset=')[1].split(';')[0].trim();
          console.log(`检测到字符编码: ${charset}`);
          html = Buffer.from(response.data).toString(charset);
        } else {
          // 默认使用UTF-8，如果失败则尝试GBK
          try {
            html = Buffer.from(response.data).toString('utf-8');
            console.log('使用UTF-8编码解析');
          } catch {
            html = Buffer.from(response.data).toString('gbk');
            console.log('使用GBK编码解析');
          }
        }
        
        console.log(`HTML内容长度: ${html.length} 字符`);
        
        // 使用Cheerio解析HTML
        const $ = cheerio.load(html);
        
        // 获取页面标题
        const title = $('title').text().trim() || '';
        console.log(`页面标题: ${title}`);
        
        // 提取主要内容
        console.log('提取主要内容...');
        const content = this.extractMainContent($);
        
        // 提取图片链接
        const images: string[] = [];
        $('img').each((_, element) => {
          const src = $(element).attr('src');
          if (src) {
            try {
              const absoluteUrl = new URL(src, url).href;
              images.push(absoluteUrl);
            } catch {
              // 忽略无效的URL
            }
          }
        });
        
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
        
        console.log(`提取完成 - 内容: ${content.length}字符, 图片: ${images.length}个, 链接: ${links.length}个`);
        
        return {
          success: true,
          content,
          title,
          images: images.slice(0, 50),
          links: links.slice(0, 100),
          statusCode: response.status,
          responseTime
        };
        
      } catch (error) {
        console.error(`HTTP爬取错误 (尝试 ${attempt}):`, error instanceof Error ? error.message : error);
        
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
        
        console.log(`等待 ${retryDelay * attempt}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    return {
      success: false,
      error: 'All retry attempts failed',
      responseTime: Date.now() - startTime
    };
  }
}

async function testStandaloneHttpCrawler() {
  console.log('=== 独立HTTP爬虫测试 ===');
  
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  console.log(`\n测试目标: ${testUrl}`);
  console.log('开始爬取...');
  
  const crawler = new StandaloneHttpCrawler();
  
  try {
    const result = await crawler.crawlPage(testUrl);
    
    console.log('\n=== 爬取结果 ===');
    console.log(`成功: ${result.success}`);
    
    if (result.success) {
      console.log(`状态码: ${result.statusCode}`);
      console.log(`响应时间: ${result.responseTime}ms`);
      console.log(`标题: ${result.title}`);
      console.log(`内容长度: ${result.content?.length || 0} 字符`);
      console.log(`图片数量: ${result.images?.length || 0}`);
      console.log(`链接数量: ${result.links?.length || 0}`);
      
      // 显示内容预览
      if (result.content) {
        console.log('\n=== 内容预览 ===');
        const preview = result.content.substring(0, 800);
        console.log(preview);
        if (result.content.length > 800) {
          console.log('\n...(内容已截断)');
        }
      }
      
      // 检查是否包含中文内容
      const chineseContent = result.content?.match(/[\u4e00-\u9fff]/g);
      if (chineseContent && chineseContent.length > 0) {
        console.log(`\n✅ 检测到中文字符: ${chineseContent.length} 个`);
      } else {
        console.log('\n⚠️  未检测到中文字符');
      }
      
      // 检查关键词
      const keywords = ['中国人民银行', '条法司', '规章制度', '法律法规', '通知', '公告'];
      const foundKeywords = keywords.filter(keyword => 
        result.content?.includes(keyword) || result.title?.includes(keyword)
      );
      
      if (foundKeywords.length > 0) {
        console.log(`✅ 找到关键词: ${foundKeywords.join(', ')}`);
      } else {
        console.log('⚠️  未找到预期关键词');
      }
      
      // 分析反爬机制
      console.log('\n=== 反爬机制分析 ===');
      if (result.content?.includes('验证码') || result.content?.includes('captcha')) {
        console.log('⚠️  检测到验证码机制');
      } else {
        console.log('✅ 未检测到验证码');
      }
      
      if (result.content?.includes('访问频率') || result.content?.includes('rate limit')) {
        console.log('⚠️  检测到频率限制');
      } else {
        console.log('✅ 未检测到频率限制');
      }
      
      if (result.content && result.content.length < 500) {
        console.log('⚠️  内容过短，可能被反爬机制拦截');
      } else {
        console.log('✅ 内容长度正常');
      }
      
    } else {
      console.log(`❌ 爬取失败: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testStandaloneHttpCrawler().catch(console.error);