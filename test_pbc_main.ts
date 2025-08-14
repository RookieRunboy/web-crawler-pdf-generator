import puppeteer from 'puppeteer';

// 专门测试中国人民银行网站的访问
async function testPBCWebsite() {
  let browser;
  let page;
  
  try {
    console.log('🚀 测试中国人民银行网站访问...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    page = await browser.newPage();
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('\n📄 步骤1: 测试访问主页...');
    
    try {
      const mainResponse = await page.goto('http://www.pbc.gov.cn/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      console.log('主页响应状态:', mainResponse?.status());
      console.log('主页URL:', mainResponse?.url());
      
      const mainTitle = await page.title();
      console.log('主页标题:', mainTitle);
      
      if (mainResponse?.status() === 200) {
        console.log('✅ 主页访问成功');
        
        // 等待一段时间
        await page.waitForTimeout(2000);
        
        console.log('\n📄 步骤2: 测试访问条法司页面...');
        
        try {
          const tiaofasiResponse = await page.goto('http://www.pbc.gov.cn/tiaofasi/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          console.log('条法司页面响应状态:', tiaofasiResponse?.status());
          console.log('条法司页面URL:', tiaofasiResponse?.url());
          
          if (tiaofasiResponse?.status() === 200) {
            console.log('✅ 条法司页面访问成功');
            
            await page.waitForTimeout(2000);
            
            console.log('\n📄 步骤3: 测试访问目标页面...');
            
            const targetResponse = await page.goto('http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html', {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });
            
            console.log('目标页面响应状态:', targetResponse?.status());
            console.log('目标页面URL:', targetResponse?.url());
            
            const targetTitle = await page.title();
            console.log('目标页面标题:', targetTitle);
            
            const bodyText = await page.evaluate(() => {
              return document.body ? document.body.innerText : '';
            });
            
            console.log('目标页面文本长度:', bodyText.length);
            
            if (bodyText.length > 100) {
              console.log('\n🎉 成功访问目标页面！');
              console.log('内容预览:', bodyText.substring(0, 500) + '...');
              return true;
            } else {
              console.log('\n⚠️  目标页面内容不足');
              console.log('页面内容:', bodyText);
              return false;
            }
            
          } else {
            console.log('❌ 条法司页面访问失败');
            return false;
          }
          
        } catch (tiaofasiError) {
          console.log('❌ 条法司页面访问错误:', tiaofasiError.message);
          
          // 如果条法司页面失败，直接尝试目标页面
          console.log('\n📄 直接尝试访问目标页面...');
          
          const directResponse = await page.goto('http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          console.log('直接访问响应状态:', directResponse?.status());
          
          if (directResponse?.status() === 200) {
            const bodyText = await page.evaluate(() => {
              return document.body ? document.body.innerText : '';
            });
            
            if (bodyText.length > 100) {
              console.log('🎉 直接访问成功！');
              console.log('内容预览:', bodyText.substring(0, 500) + '...');
              return true;
            }
          }
          
          return false;
        }
        
      } else {
        console.log('❌ 主页访问失败，状态码:', mainResponse?.status());
        return false;
      }
      
    } catch (mainError) {
      console.log('❌ 主页访问错误:', mainError.message);
      
      if (mainError.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.log('\n🔍 ERR_BLOCKED_BY_CLIENT 详细分析:');
        console.log('这个错误通常表示:');
        console.log('1. 本地网络策略阻止了对该域名的访问');
        console.log('2. 系统防火墙或安全软件拦截');
        console.log('3. 企业网络环境的访问限制');
        console.log('4. DNS解析被重定向或阻止');
        
        console.log('\n🛠️  尝试解决方案:');
        console.log('- 检查系统是否安装了网络安全软件');
        console.log('- 尝试使用手机热点等不同网络环境');
        console.log('- 检查DNS设置（可尝试8.8.8.8或114.114.114.114）');
        console.log('- 检查系统防火墙设置');
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    return false;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    console.log('\n🏁 测试完成');
  }
}

// 测试DNS解析
async function testDNSResolution() {
  console.log('\n🌐 DNS解析测试:');
  
  try {
    const dns = require('dns').promises;
    const addresses = await dns.lookup('www.pbc.gov.cn');
    console.log('✅ DNS解析成功:', addresses);
    return true;
  } catch (dnsError) {
    console.log('❌ DNS解析失败:', dnsError.message);
    return false;
  }
}

async function main() {
  const dnsOk = await testDNSResolution();
  
  if (!dnsOk) {
    console.log('\n⚠️  DNS解析失败，可能影响网站访问');
  }
  
  const success = await testPBCWebsite();
  console.log('\n📊 最终结果:', success ? '✅ 成功' : '❌ 失败');
  
  if (!success) {
    console.log('\n💡 下一步建议:');
    console.log('1. 检查网络环境是否有访问限制');
    console.log('2. 尝试使用不同的网络连接');
    console.log('3. 考虑使用代理或VPN');
    console.log('4. 检查系统安全软件设置');
  }
  
  process.exit(success ? 0 : 1);
}

main();