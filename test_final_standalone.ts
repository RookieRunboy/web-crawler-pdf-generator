import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * 最终独立测试类
 * 验证所有反反爬策略的综合效果
 */
class FinalStandaloneCrawler {
  private userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  private currentUserAgentIndex = 0;
  private lastRequestTime = 0;
  private requestCount = 0;
  private sessionStartTime = Date.now();
  
  private getNextUserAgent(): string {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }
  
  private getRandomAcceptLanguage(): string {
    const languages = [
      'zh-CN,zh;q=0.9,en;q=0.8',
      'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7',
      'zh-CN,zh;q=0.9'
    ];
    return languages[Math.floor(Math.random() * languages.length)];
  }
  
  private getRandomCacheControl(): string {
    const controls = ['no-cache', 'max-age=0', 'no-store', 'must-revalidate'];
    return controls[Math.floor(Math.random() * controls.length)];
  }
  
  private generateRealisticHeaders(userAgent: string): Record<string, string> {
    const isChrome = userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edg');
    
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': this.getRandomAcceptLanguage(),
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': Math.random() > 0.5 ? '1' : '0',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': this.getRandomCacheControl(),
      'Pragma': 'no-cache'
    };
    
    if (isChrome) {
      headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"macOS"';
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = Math.random() > 0.5 ? 'none' : 'same-origin';
      headers['Sec-Fetch-User'] = '?1';
    }
    
    return headers;
  }
  
  private async applyIntelligentDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const sessionDuration = (now - this.sessionStartTime) / 1000 / 60; // 分钟
    const requestFrequency = this.requestCount / Math.max(sessionDuration, 0.1);
    
    let delay = 0;
    
    // 基础延迟
    if (timeSinceLastRequest < 1000) {
      delay += 1000 - timeSinceLastRequest;
    }
    
    // 频率控制
    if (requestFrequency > 10) {
      delay += Math.random() * 2000 + 1000;
    } else if (requestFrequency > 5) {
      delay += Math.random() * 1000 + 500;
    }
    
    // 随机人性化停顿
    delay += Math.random() * 1000 + 200;
    
    console.log(`应用智能延迟: ${Math.round(delay)}ms (请求频率: ${requestFrequency.toFixed(1)}/min)`);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
  
  private getRandomTimeout(): number {
    return Math.floor(Math.random() * 5000) + 10000; // 10-15秒
  }
  
  private shouldRotateUserAgent(): boolean {
    return this.requestCount % 3 === 0 || Math.random() < 0.3;
  }
  
  private async decompressResponse(buffer: Buffer, encoding?: string): Promise<string> {
    try {
      if (encoding === 'gzip') {
        const decompressed = await gunzip(buffer);
        return decompressed.toString('utf-8');
      } else if (encoding === 'deflate') {
        const decompressed = await inflate(buffer);
        return decompressed.toString('utf-8');
      } else if (encoding === 'br') {
        const decompressed = await brotliDecompress(buffer);
        return decompressed.toString('utf-8');
      }
    } catch (error) {
      console.warn(`解压缩失败 (${encoding}):`, error);
    }
    return buffer.toString('utf-8');
  }
  
  private extractMainContent($: cheerio.CheerioAPI): string {
    // 移除无关元素
    $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation').remove();
    
    // 语义化标签优先
    const semanticSelectors = ['main', 'article', '.content', '.main-content', '.article-content', '.post-content'];
    for (const selector of semanticSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        return element.text().trim();
      }
    }
    
    // 文本密度算法
    let bestElement = null;
    let bestScore = 0;
    
    $('div, p, section').each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      const textLength = text.length;
      const linkLength = $el.find('a').text().length;
      const score = textLength - linkLength * 2;
      
      if (score > bestScore && textLength > 50) {
        bestScore = score;
        bestElement = $el;
      }
    });
    
    if (bestElement) {
      return $(bestElement).text().trim();
    }
    
    // 回退策略
    return $('body').text().trim();
  }
  
  public async crawlPage(url: string, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n=== 最终测试 - 尝试 ${attempt}/${maxRetries} ===`);
        
        await this.applyIntelligentDelay();
        
        const userAgent = this.shouldRotateUserAgent() || attempt > 1 ? 
          this.getNextUserAgent() : this.userAgents[this.currentUserAgentIndex];
        
        const headers = this.generateRealisticHeaders(userAgent);
        console.log(`使用User-Agent: ${userAgent.substring(0, 50)}...`);
        console.log(`请求头数量: ${Object.keys(headers).length}`);
        
        const response = await axios.get(url, {
          headers,
          timeout: this.getRandomTimeout(),
          responseType: 'arraybuffer',
          validateStatus: (status) => status < 500,
          maxRedirects: 5
        });
        
        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentEncoding = response.headers['content-encoding'];
        const html = await this.decompressResponse(Buffer.from(response.data), contentEncoding);
        
        const $ = cheerio.load(html);
        const title = $('title').text().trim();
        const content = this.extractMainContent($);
        
        const images = $('img').map((_, el) => $(el).attr('src')).get().filter(Boolean);
        const links = $('a[href]').map((_, el) => $(el).attr('href')).get().filter(Boolean);
        
        return {
          success: true,
          statusCode: response.status,
          title,
          content: content.substring(0, 500),
          images,
          links,
          userAgent,
          attempt
        };
        
      } catch (error: any) {
        console.log(`尝试 ${attempt} 失败: ${error.message}`);
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error.message,
            attempt
          };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

/**
 * 最终独立测试
 */
async function testFinalStandalone() {
  console.log('=== 最终独立反反爬测试 ===');
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  console.log(`目标URL: ${testUrl}`);
  console.log('开始测试...');
  
  const crawler = new FinalStandaloneCrawler();
  const startTime = Date.now();
  
  try {
    const result = await crawler.crawlPage(testUrl);
    const endTime = Date.now();
    
    console.log('\n=== 测试结果 ===');
    if (result.success) {
      console.log(`✅ 爬取成功!`);
      console.log(`耗时: ${endTime - startTime}ms`);
      console.log(`状态码: ${result.statusCode}`);
      console.log(`标题: ${result.title}`);
      console.log(`内容长度: ${result.content.length} 字符`);
      console.log(`图片数量: ${result.images.length}`);
      console.log(`链接数量: ${result.links.length}`);
      console.log(`使用的User-Agent: ${result.userAgent.substring(0, 50)}...`);
      console.log(`尝试次数: ${result.attempt}`);
      
      console.log('\n内容预览:');
      console.log(result.content + '...');
      
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
      
      // 数据质量评估
      const contentQuality = {
        hasTitle: !!result.title && result.title.length > 0,
        hasContent: result.content.length > 100,
        hasChinese: hasChinese,
        hasKeywords: foundKeywords.length > 0,
        hasImages: result.images.length > 0,
        hasLinks: result.links.length > 0
      };
      
      const qualityScore = Object.values(contentQuality).filter(Boolean).length;
      console.log(`\n📊 数据质量评分: ${qualityScore}/6`);
      console.log('质量检查详情:', contentQuality);
      
      if (qualityScore >= 5) {
        console.log('\n🎉 反反爬升级大成功！数据质量优秀！');
      } else if (qualityScore >= 4) {
        console.log('\n✅ 反反爬升级成功！数据质量良好！');
      } else {
        console.log('\n⚠️  数据质量一般，可能需要进一步优化');
      }
      
    } else {
      console.log(`❌ 爬取失败: ${result.error}`);
    }
    
  } catch (error: any) {
    console.error('测试过程中发生错误:', error.message);
  }
  
  console.log('\n=== 最终测试完成 ===');
}

// 运行测试
testFinalStandalone().catch(console.error);