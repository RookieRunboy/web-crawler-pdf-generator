import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * 增强版反反爬测试类
 * 集成所有最新的反检测策略
 */
class EnhancedAntiDetectionCrawler {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private sessionStartTime: number = Date.now();
  private currentUserAgentIndex: number = 0;

  private userAgents = [
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    // Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  ];

  private getNextUserAgent(): string {
    return this.userAgents[this.currentUserAgentIndex];
  }

  private generateRealisticHeaders(userAgent: string, url: string): Record<string, string> {
    const parsedUrl = new URL(url);
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isFirefox = userAgent.includes('Firefox');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edg');
    const isMac = userAgent.includes('Macintosh');
    const isWindows = userAgent.includes('Windows');
    const isLinux = userAgent.includes('Linux');
    
    // 基础请求头
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept-Language': this.getRandomAcceptLanguage(),
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': Math.random() > 0.5 ? '1' : '0',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': this.getRandomCacheControl(),
      'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'Host': parsedUrl.host
    };

    // 根据浏览器类型设置Accept头
    if (isChrome || isEdge) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    } else if (isFirefox) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    } else if (isSafari) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    }

    // Sec-Fetch 头（Chrome和Edge）
    if (isChrome || isEdge) {
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = Math.random() > 0.7 ? 'same-origin' : 'none';
      headers['Sec-Fetch-User'] = '?1';
      
      // Client Hints
      const chromeVersion = this.extractChromeVersion(userAgent);
      headers['sec-ch-ua'] = `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "${isEdge ? 'Microsoft Edge' : 'Google Chrome'}";v="${chromeVersion}"`;
      headers['sec-ch-ua-mobile'] = '?0';
      
      if (isMac) {
        headers['sec-ch-ua-platform'] = '"macOS"';
      } else if (isWindows) {
        headers['sec-ch-ua-platform'] = '"Windows"';
      } else if (isLinux) {
        headers['sec-ch-ua-platform'] = '"Linux"';
      }
    }

    // 随机添加一些可选头
    if (Math.random() > 0.3) {
      headers['Pragma'] = 'no-cache';
    }
    
    if (Math.random() > 0.5) {
      headers['Sec-GPC'] = '1';
    }

    return headers;
  }

  private getRandomAcceptLanguage(): string {
    const languages = [
      'zh-CN,zh;q=0.9,en;q=0.8',
      'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
      'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7',
      'zh-CN,en;q=0.9,zh;q=0.8'
    ];
    return languages[Math.floor(Math.random() * languages.length)];
  }

  private getRandomCacheControl(): string {
    const controls = [
      'max-age=0',
      'no-cache',
      'max-age=0, no-cache',
      'no-cache, no-store, must-revalidate'
    ];
    return controls[Math.floor(Math.random() * controls.length)];
  }

  private extractChromeVersion(userAgent: string): string {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? match[1] : '120';
  }

  private async applyIntelligentDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // 基础延迟：200-800ms
    let baseDelay = Math.random() * 600 + 200;
    
    // 根据请求频率调整延迟
    const sessionDuration = now - this.sessionStartTime;
    const requestsPerMinute = (this.requestCount / sessionDuration) * 60000;
    
    if (requestsPerMinute > 30) {
      // 高频请求，增加延迟
      baseDelay *= 2;
    } else if (requestsPerMinute > 20) {
      baseDelay *= 1.5;
    }
    
    // 如果上次请求时间太近，额外延迟
    if (timeSinceLastRequest < 1000) {
      baseDelay += Math.random() * 1000 + 500;
    }
    
    // 随机化延迟模式
    if (Math.random() > 0.8) {
      // 20%概率模拟用户停顿思考
      baseDelay += Math.random() * 2000 + 1000;
    }
    
    // 限制最大延迟
    baseDelay = Math.min(baseDelay, 5000);
    
    console.log(`应用智能延迟: ${Math.round(baseDelay)}ms (请求频率: ${requestsPerMinute.toFixed(1)}/min)`);
    
    if (baseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, baseDelay));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private getRandomTimeout(): number {
    // 随机超时时间：15-30秒
    return Math.random() * 15000 + 15000;
  }

  private shouldRotateUserAgent(): boolean {
    // 每5-15个请求轮换一次User-Agent
    const rotationInterval = Math.random() * 10 + 5;
    return this.requestCount % Math.floor(rotationInterval) === 0;
  }

  async crawlPage(url: string): Promise<any> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n=== 增强版反反爬测试 - 尝试 ${attempt}/${maxRetries} ===`);
        
        // 应用智能延迟
        await this.applyIntelligentDelay();
        
        // 根据策略决定是否轮换User-Agent
        if (this.shouldRotateUserAgent() || attempt > 1) {
          this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
          console.log(`轮换User-Agent: ${this.getNextUserAgent().substring(0, 50)}...`);
        }
        
        const userAgent = this.getNextUserAgent();
        const headers = this.generateRealisticHeaders(userAgent, url);
        
        console.log(`使用User-Agent: ${userAgent.substring(0, 50)}...`);
        console.log(`请求头数量: ${Object.keys(headers).length}`);
        
        const startTime = Date.now();
        const response = await axios.get(url, {
          headers,
          timeout: this.getRandomTimeout(),
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          responseType: 'arraybuffer'
        });
        
        const endTime = Date.now();
        
        // 处理响应数据
        let html: string;
        const contentEncoding = response.headers['content-encoding'];
        
        if (contentEncoding === 'gzip' || contentEncoding === 'deflate' || contentEncoding === 'br') {
          const zlib = require('zlib');
          if (contentEncoding === 'gzip') {
            html = zlib.gunzipSync(response.data).toString('utf-8');
          } else if (contentEncoding === 'deflate') {
            html = zlib.inflateSync(response.data).toString('utf-8');
          } else {
            html = zlib.brotliDecompressSync(response.data).toString('utf-8');
          }
        } else {
          html = response.data.toString('utf-8');
        }
        
        const $ = cheerio.load(html);
        const title = $('title').text().trim();
        
        // 提取主要内容
        const content = this.extractMainContent($);
        
        // 提取图片和链接
        const images = $('img').map((_, el) => $(el).attr('src')).get().filter(Boolean);
        const links = $('a[href]').map((_, el) => $(el).attr('href')).get().filter(Boolean);
        
        return {
          success: true,
          statusCode: response.status,
          title,
          content,
          images,
          links,
          duration: endTime - startTime,
          userAgent: userAgent.substring(0, 50) + '...',
          requestCount: this.requestCount,
          sessionDuration: Date.now() - this.sessionStartTime
        };
        
      } catch (error: any) {
        lastError = error;
        console.log(`尝试 ${attempt} 失败:`, error.message);
        
        if (attempt < maxRetries) {
          const retryDelay = Math.random() * 2000 + 1000;
          console.log(`等待 ${Math.round(retryDelay)}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || '未知错误',
      requestCount: this.requestCount,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // 移除无关元素
    $('script, style, nav, header, footer, aside, .nav, .menu, .sidebar').remove();
    
    // 尝试语义化标签
    let content = $('main, article, .content, .main-content, #content, #main').first().text();
    
    if (!content || content.length < 100) {
      // 回退到body内容
      content = $('body').text();
    }
    
    return content.replace(/\s+/g, ' ').trim().substring(0, 500);
  }
}

// 测试函数
async function testEnhancedAntiDetection() {
  const crawler = new EnhancedAntiDetectionCrawler();
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  console.log('=== 增强版反反爬策略测试 ===');
  console.log(`目标URL: ${testUrl}`);
  console.log('开始测试...');
  
  const result = await crawler.crawlPage(testUrl);
  
  console.log('\n=== 测试结果 ===');
  if (result.success) {
    console.log(`✅ 爬取成功!`);
    console.log(`耗时: ${result.duration}ms`);
    console.log(`状态码: ${result.statusCode}`);
    console.log(`标题: ${result.title}`);
    console.log(`内容长度: ${result.content.length} 字符`);
    console.log(`图片数量: ${result.images.length}`);
    console.log(`链接数量: ${result.links.length}`);
    console.log(`使用的User-Agent: ${result.userAgent}`);
    console.log(`总请求次数: ${result.requestCount}`);
    console.log(`会话时长: ${Math.round(result.sessionDuration / 1000)}秒`);
    
    console.log('\n内容预览:');
    console.log(result.content.substring(0, 200) + '...');
    
    // 检查中文内容
    const hasChinese = /[\u4e00-\u9fa5]/.test(result.content);
    console.log(`\n包含中文内容: ${hasChinese}`);
    
    // 检查关键词
    const keywords = ['中国人民银行', '金融', '政策', '管理办法', '通知'];
    const foundKeywords = keywords.filter(keyword => result.content.includes(keyword));
    if (foundKeywords.length > 0) {
      console.log(`找到关键词: ${foundKeywords.join(', ')}`);
    }
    
    // 反爬检测
    const antiCrawlerSigns = [
      'blocked', 'forbidden', '403', '验证码', 'captcha', 
      'robot', 'bot', '访问频繁', '请稍后再试'
    ];
    const detectedSigns = antiCrawlerSigns.filter(sign => 
      result.content.toLowerCase().includes(sign.toLowerCase())
    );
    
    if (detectedSigns.length > 0) {
      console.log(`\n⚠️  检测到可能的反爬机制: ${detectedSigns.join(', ')}`);
    } else {
      console.log('\n✅ 未检测到明显的反爬机制');
    }
    
  } else {
    console.log(`❌ 爬取失败: ${result.error}`);
    console.log(`总请求次数: ${result.requestCount}`);
    console.log(`会话时长: ${Math.round(result.sessionDuration / 1000)}秒`);
  }
}

// 运行测试
testEnhancedAntiDetection().catch(console.error);