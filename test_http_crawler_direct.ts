import axios from 'axios';
import * as zlib from 'zlib';
import * as cheerio from 'cheerio';
import { URL } from 'url';

// 模拟CrawlerService的HTTP爬虫功能
class DirectHttpCrawler {
  private userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  private currentUserAgentIndex = 0;
  
  private getNextUserAgent(): string {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }
  
  private generateRealisticHeaders(url: string): Record<string, string> {
    const userAgent = this.getNextUserAgent();
    const parsedUrl = new URL(url);
    
    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'Host': parsedUrl.host
    };
  }
  
  private extractMainContent($: cheerio.CheerioAPI, url: string): string {
    // 移除无关元素
    const irrelevantSelectors = [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer', '.navbar', '.navigation', '.nav',
      'aside', '.sidebar', '.side-bar', '.widget', '.widgets',
      '.advertisement', '.ads', '.ad', '.advert', '.banner',
      '.sponsored', '.promotion', '.promo',
      '.comments', '.comment', '.social', '.share', '.sharing',
      '.related', '.recommended', '.suggestions', '.more-stories',
      '.breadcrumb', '.breadcrumbs', '.tags', '.tag-list',
      '.author-info', '.author-bio', '.meta', '.metadata',
      '.popup', '.modal', '.overlay', '.cookie-notice'
    ];
    
    irrelevantSelectors.forEach(selector => {
      $(selector).remove();
    });
    
    // 查找语义化内容容器
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
      if (element.length > 0 && element.text().trim().length > 100) {
        return element.text().trim();
      }
    }
    
    // 回退到body内容
    return $('body').text().trim();
  }
  
  async crawlPage(url: string): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 2000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`HTTP爬取尝试 ${attempt}/${maxRetries}: ${url}`);
        
        const headers = this.generateRealisticHeaders(url);
        
        const response = await axios.get(url, {
          headers,
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          responseType: 'arraybuffer'
        });
        
        // 处理压缩响应
        let content: string;
        const encoding = response.headers['content-encoding'];
        
        if (encoding === 'gzip') {
          content = zlib.gunzipSync(response.data).toString('utf-8');
        } else if (encoding === 'deflate') {
          content = zlib.inflateSync(response.data).toString('utf-8');
        } else {
          content = response.data.toString('utf-8');
        }
        
        // 使用Cheerio解析HTML
        const $ = cheerio.load(content);
        
        // 提取标题
        const title = $('title').text().trim() || $('h1').first().text().trim() || '';
        
        // 提取主要内容
        const mainContent = this.extractMainContent($, url);
        
        // 提取图片链接
        const images: string[] = [];
        $('img[src]').each((_, element) => {
          const src = $(element).attr('src');
          if (src) {
            try {
              const imageUrl = new URL(src, url).href;
              images.push(imageUrl);
            } catch (e) {
              // 忽略无效的URL
            }
          }
        });
        
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
          content: mainContent,
          title,
          images: images.slice(0, 50),
          links: links.slice(0, 100),
          statusCode: response.status
        };
        
      } catch (error) {
        console.error(`HTTP爬取错误 (尝试 ${attempt}):`, error);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'HTTP爬取失败'
          };
        }
        
        // 等待重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    return {
      success: false,
      error: '所有HTTP爬取尝试都失败了'
    };
  }
}

async function testDirectHttpCrawler() {
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  console.log('=== 测试直接HTTP爬虫功能 ===');
  console.log(`目标URL: ${testUrl}`);
  console.log('开始爬取...');
  
  const startTime = Date.now();
  const crawler = new DirectHttpCrawler();
  
  try {
    const result = await crawler.crawlPage(testUrl);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n=== 爬取结果 ===');
    console.log(`耗时: ${duration}ms`);
    console.log(`成功: ${result.success}`);
    
    if (result.success) {
      console.log(`状态码: ${result.statusCode}`);
      console.log(`标题: ${result.title}`);
      console.log(`内容长度: ${result.content?.length || 0} 字符`);
      console.log(`图片数量: ${result.images?.length || 0}`);
      console.log(`链接数量: ${result.links?.length || 0}`);
      
      // 内容预览
      if (result.content) {
        const preview = result.content.substring(0, 200);
        console.log(`\n内容预览: ${preview}...`);
        
        // 检查是否包含中文内容
        const chineseRegex = /[\u4e00-\u9fff]/;
        const hasChineseContent = chineseRegex.test(result.content);
        console.log(`包含中文内容: ${hasChineseContent}`);
        
        // 检查关键词
        const keywords = ['中国人民银行', '央行', '金融', '货币', '政策'];
        const foundKeywords = keywords.filter(keyword => result.content.includes(keyword));
        console.log(`找到关键词: ${foundKeywords.join(', ')}`);
      }
      
      // 检查是否有反爬机制的迹象
      const antiCrawlerSigns = [
        'Access Denied',
        'Forbidden',
        'Robot Check',
        'Verification Required',
        'Please enable JavaScript',
        '请开启JavaScript',
        '验证码',
        '人机验证'
      ];
      
      const detectedSigns = antiCrawlerSigns.filter(sign => 
        result.content?.includes(sign) || result.title?.includes(sign)
      );
      
      if (detectedSigns.length > 0) {
        console.log(`\n⚠️  检测到可能的反爬机制: ${detectedSigns.join(', ')}`);
      } else {
        console.log('\n✅ 未检测到明显的反爬机制');
      }
      
    } else {
      console.log(`错误: ${result.error}`);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testDirectHttpCrawler().catch(console.error);