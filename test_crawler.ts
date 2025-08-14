import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// 添加隐身插件
puppeteerExtra.use(StealthPlugin());

async function testCrawler() {
  let browser;
  let page;
  
  try {
    console.log('启动浏览器...');
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    page = await browser.newPage();
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置视口
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('开始访问中国人民银行网站...');
    const targetUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
    
    const response = await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('响应状态:', response?.status());
    console.log('响应URL:', response?.url());
    
    // 等待页面加载
    await page.waitForTimeout(3000);
    
    // 获取页面标题
    const title = await page.title();
    console.log('页面标题:', title);
    
    // 获取页面内容
    const content = await page.content();
    console.log('页面内容长度:', content.length);
    
    // 检查是否有反爬虫检测
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('页面文本长度:', bodyText.length);
    
    if (bodyText.includes('验证码') || bodyText.includes('captcha') || bodyText.includes('robot')) {
      console.log('⚠️ 检测到可能的反爬虫机制');
    }
    
    if (bodyText.length < 100) {
      console.log('⚠️ 页面内容过少，可能被反爬虫拦截');
      console.log('页面文本预览:', bodyText.substring(0, 200));
    } else {
      console.log('✅ 成功获取页面内容');
      console.log('内容预览:', bodyText.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ 爬取失败:', error.message);
    if (error.message.includes('timeout')) {
      console.log('可能原因: 网络超时或页面加载缓慢');
    } else if (error.message.includes('net::ERR')) {
      console.log('可能原因: 网络连接问题或被拒绝访问');
    }
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    console.log('测试完成');
  }
}

testCrawler();