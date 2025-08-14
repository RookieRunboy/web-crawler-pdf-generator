import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// 添加隐身插件
puppeteerExtra.use(StealthPlugin());

// 高级反反爬虫测试
async function testAdvancedCrawler() {
  let browser;
  let page;
  
  try {
    console.log('🚀 启动高级反反爬虫测试...');
    
    // 简化的浏览器启动参数，避免ERR_BLOCKED_BY_CLIENT
    browser = await puppeteerExtra.launch({
      headless: true, // 改为无头模式
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true
    });
    
    page = await browser.newPage();
    
    // 1. 设置真实的浏览器指纹
    console.log('🔧 设置浏览器指纹伪装...');
    
    // 移除webdriver痕迹
    await page.evaluateOnNewDocument(() => {
      // 删除webdriver属性
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // 重写chrome对象
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // 模拟真实的插件
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format"
            },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          }
        ]
      });
      
      // 模拟真实的语言
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      });
      
      // 模拟真实的平台
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });
      
      // 模拟真实的用户代理数据
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
          brands: [
            { brand: 'Google Chrome', version: '120' },
            { brand: 'Chromium', version: '120' },
            { brand: 'Not_A Brand', version: '99' }
          ],
          mobile: false,
          platform: 'macOS'
        })
      });
    });
    
    // 2. 设置真实的User-Agent和请求头
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });
    
    // 3. 设置真实的视口
    await page.setViewport({ 
      width: 1366, 
      height: 768,
      deviceScaleFactor: 1
    });
    
    console.log('🌐 开始访问中国人民银行网站...');
    const targetUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
    
    // 4. 先访问主页建立会话
    console.log('📄 先访问主页建立会话...');
    try {
      const homeResponse = await page.goto('http://www.pbc.gov.cn/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('主页响应状态:', homeResponse?.status());
      
      // 等待并模拟用户行为
      await page.waitForTimeout(2000);
      
      // 模拟滚动
      await page.evaluate(() => {
        window.scrollTo(0, 300);
      });
      await page.waitForTimeout(1000);
      
    } catch (homeError) {
      console.log('主页访问失败，直接访问目标页面:', homeError.message);
    }
    
    console.log('🎯 现在访问目标页面...');
    
    // 5. 访问目标页面
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('📊 响应状态:', response?.status());
    console.log('🔗 响应URL:', response?.url());
    
    // 等待页面加载
    await page.waitForTimeout(3000);
    
    // 6. 检查页面内容
    const title = await page.title();
    console.log('📝 页面标题:', title);
    
    const content = await page.content();
    console.log('📄 页面HTML长度:', content.length);
    
    // 检查是否有正文内容
    const bodyText = await page.evaluate(() => {
      const body = document.body;
      return body ? body.innerText : '';
    });
    
    console.log('📖 页面文本长度:', bodyText.length);
    
    // 7. 分析反爬虫机制
    console.log('\n🔍 反爬虫机制分析:');
    
    const analysisResults = [];
    
    if (bodyText.includes('验证码') || bodyText.includes('captcha') || bodyText.includes('robot')) {
      analysisResults.push('⚠️  检测到验证码或机器人检测');
    }
    
    if (bodyText.includes('403') || bodyText.includes('Forbidden')) {
      analysisResults.push('⚠️  检测到403禁止访问');
    }
    
    if (bodyText.includes('请稍后') || bodyText.includes('请等待')) {
      analysisResults.push('⚠️  检测到频率限制');
    }
    
    if (bodyText.includes('JavaScript') && bodyText.includes('disabled')) {
      analysisResults.push('⚠️  需要JavaScript支持');
    }
    
    if (response?.status() === 200 && bodyText.length < 100) {
      analysisResults.push('⚠️  页面内容过少，可能被拦截');
    }
    
    if (analysisResults.length === 0) {
      console.log('✅ 未检测到明显的反爬虫机制');
    } else {
      analysisResults.forEach(result => console.log(result));
    }
    
    // 8. 检查页面元素和内容质量
    const contentAnalysis = await page.evaluate(() => {
      const title = document.title;
      const mainContent = document.querySelector('div, article, main, section');
      const links = document.querySelectorAll('a').length;
      const images = document.querySelectorAll('img').length;
      const scripts = document.querySelectorAll('script').length;
      
      return {
        title,
        mainContentLength: mainContent ? mainContent.textContent?.length || 0 : 0,
        links,
        images,
        scripts,
        hasContent: mainContent ? mainContent.textContent?.trim().length > 100 : false
      };
    });
    
    console.log('\n📊 页面内容分析:');
    console.log('- 标题:', contentAnalysis.title);
    console.log('- 主要内容长度:', contentAnalysis.mainContentLength);
    console.log('- 链接数量:', contentAnalysis.links);
    console.log('- 图片数量:', contentAnalysis.images);
    console.log('- 脚本数量:', contentAnalysis.scripts);
    
    if (contentAnalysis.hasContent && contentAnalysis.mainContentLength > 500) {
      console.log('\n🎉 爬取成功！获得了有效内容');
      console.log('内容预览:', bodyText.substring(0, 300) + '...');
      return true;
    } else {
      console.log('\n❌ 爬取失败，内容不足或质量低');
      console.log('页面文本预览:', bodyText.substring(0, 200));
      return false;
    }
    
  } catch (error) {
    console.error('❌ 爬取过程中发生错误:', error.message);
    
    if (error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.log('🚫 被客户端阻止 - 可能是本地安全策略或网络配置问题');
      console.log('建议: 检查防火墙、代理设置或尝试不同的网络环境');
    } else if (error.message.includes('timeout')) {
      console.log('⏰ 超时 - 网络缓慢或页面加载问题');
    } else if (error.message.includes('net::ERR')) {
      console.log('🌐 网络错误 - 连接被拒绝或DNS问题');
    }
    
    return false;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    console.log('\n🏁 测试完成');
  }
}

testAdvancedCrawler().then(success => {
  console.log('\n📊 最终结果:', success ? '✅ 成功' : '❌ 失败');
  process.exit(success ? 0 : 1);
});