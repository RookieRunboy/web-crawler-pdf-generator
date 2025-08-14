import puppeteer from 'puppeteer';

// 简单的原生Puppeteer测试，不使用任何插件
async function testSimpleCrawler() {
  let browser;
  let page;
  
  try {
    console.log('🚀 启动简单爬虫测试（原生Puppeteer）...');
    
    // 最简单的浏览器启动配置
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    page = await browser.newPage();
    
    // 设置基本的User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 测试网络连接...');
    
    // 先测试一个简单的网站
    try {
      console.log('📄 测试访问百度...');
      const baiduResponse = await page.goto('https://www.baidu.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('百度响应状态:', baiduResponse?.status());
      
      const baiduTitle = await page.title();
      console.log('百度页面标题:', baiduTitle);
      
      if (baiduResponse?.status() === 200) {
        console.log('✅ 基础网络连接正常');
      }
      
    } catch (baiduError) {
      console.log('❌ 百度访问失败:', baiduError.message);
      console.log('⚠️  可能存在网络连接问题');
    }
    
    console.log('\n🎯 现在测试目标网站...');
    const targetUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
    
    // 测试目标网站
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('📊 响应状态:', response?.status());
    console.log('🔗 响应URL:', response?.url());
    
    // 等待页面加载
    await page.waitForTimeout(3000);
    
    // 获取页面内容
    const title = await page.title();
    console.log('📝 页面标题:', title);
    
    const bodyText = await page.evaluate(() => {
      return document.body ? document.body.innerText : '';
    });
    
    console.log('📖 页面文本长度:', bodyText.length);
    
    if (bodyText.length > 100) {
      console.log('✅ 成功获取页面内容');
      console.log('内容预览:', bodyText.substring(0, 300) + '...');
      return true;
    } else {
      console.log('❌ 页面内容不足');
      console.log('页面文本:', bodyText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 爬取过程中发生错误:', error.message);
    
    if (error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.log('\n🔍 ERR_BLOCKED_BY_CLIENT 错误分析:');
      console.log('1. 可能是本地防火墙或安全软件阻止');
      console.log('2. 可能是代理设置问题');
      console.log('3. 可能是DNS解析问题');
      console.log('4. 可能是系统网络配置问题');
      console.log('\n💡 建议解决方案:');
      console.log('- 检查系统防火墙设置');
      console.log('- 检查是否有代理软件运行');
      console.log('- 尝试使用不同的DNS服务器');
      console.log('- 尝试在不同的网络环境下运行');
    }
    
    return false;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    console.log('\n🏁 测试完成');
  }
}

// 同时测试网络环境
async function testNetworkEnvironment() {
  console.log('\n🌐 网络环境检测:');
  
  // 检查环境变量
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  
  if (httpProxy) {
    console.log('🔍 检测到HTTP代理:', httpProxy);
  }
  if (httpsProxy) {
    console.log('🔍 检测到HTTPS代理:', httpsProxy);
  }
  if (noProxy) {
    console.log('🔍 检测到NO_PROXY设置:', noProxy);
  }
  
  if (!httpProxy && !httpsProxy) {
    console.log('✅ 未检测到代理设置');
  }
}

async function main() {
  await testNetworkEnvironment();
  const success = await testSimpleCrawler();
  console.log('\n📊 最终结果:', success ? '✅ 成功' : '❌ 失败');
  process.exit(success ? 0 : 1);
}

main();