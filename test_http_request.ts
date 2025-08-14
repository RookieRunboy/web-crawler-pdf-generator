import https from 'https';
import http from 'http';
import { URL } from 'url';
import zlib from 'zlib';

// 使用Node.js原生HTTP请求测试网站访问
async function testHTTPRequest(url: string): Promise<{success: boolean, data?: string, error?: string, statusCode?: number}> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        timeout: 30000
      };
      
      const req = client.request(options, (res) => {
        let data: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          data.push(chunk);
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(data);
          let content = '';
          
          // 处理压缩响应
          const encoding = res.headers['content-encoding'];
          
          try {
            if (encoding === 'gzip') {
              content = zlib.gunzipSync(buffer).toString('utf8');
            } else if (encoding === 'deflate') {
              content = zlib.inflateSync(buffer).toString('utf8');
            } else {
              content = buffer.toString('utf8');
            }
          } catch (error) {
            // 如果解压失败，尝试直接解码
            content = buffer.toString('utf8');
          }
          
          resolve({
            success: true,
            data: content,
            statusCode: res.statusCode
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });
      
      req.end();
      
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

// 测试DNS解析（修复版本）
async function testDNSResolution(): Promise<boolean> {
  try {
    const { lookup } = await import('dns/promises');
    const result = await lookup('www.pbc.gov.cn');
    console.log('✅ DNS解析成功:', result);
    return true;
  } catch (error) {
    console.log('❌ DNS解析失败:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// 主测试函数
async function main() {
  console.log('🚀 开始HTTP请求测试...');
  
  // 1. 测试DNS解析
  console.log('\n🌐 DNS解析测试:');
  const dnsOk = await testDNSResolution();
  
  if (!dnsOk) {
    console.log('⚠️  DNS解析失败，但继续进行HTTP测试...');
  }
  
  // 2. 测试基础网络连接
  console.log('\n📄 测试基础网络连接（百度）...');
  const baiduResult = await testHTTPRequest('https://www.baidu.com');
  
  if (baiduResult.success) {
    console.log('✅ 百度访问成功，状态码:', baiduResult.statusCode);
    console.log('响应长度:', baiduResult.data?.length);
  } else {
    console.log('❌ 百度访问失败:', baiduResult.error);
  }
  
  // 3. 测试中国人民银行主页
  console.log('\n📄 测试中国人民银行主页...');
  const pbcMainResult = await testHTTPRequest('http://www.pbc.gov.cn/');
  
  if (pbcMainResult.success) {
    console.log('✅ 人民银行主页访问成功，状态码:', pbcMainResult.statusCode);
    console.log('响应长度:', pbcMainResult.data?.length);
    
    // 检查是否包含有效内容
    if (pbcMainResult.data && pbcMainResult.data.includes('中国人民银行')) {
      console.log('✅ 主页包含有效内容');
    } else {
      console.log('⚠️  主页内容可能不完整');
    }
  } else {
    console.log('❌ 人民银行主页访问失败:', pbcMainResult.error);
  }
  
  // 4. 测试目标页面
  console.log('\n🎯 测试目标页面...');
  const targetUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  const targetResult = await testHTTPRequest(targetUrl);
  
  if (targetResult.success) {
    console.log('✅ 目标页面访问成功，状态码:', targetResult.statusCode);
    console.log('响应长度:', targetResult.data?.length);
    
    if (targetResult.data) {
      // 分析页面内容
      const content = targetResult.data;
      
      console.log('\n📊 页面内容分析:');
      
      // 检查是否是HTML页面
      if (content.includes('<html') || content.includes('<!DOCTYPE')) {
        console.log('✅ 获得HTML页面');
        
        // 提取标题
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          console.log('📝 页面标题:', titleMatch[1].trim());
        }
        
        // 检查内容长度
        if (content.length > 1000) {
          console.log('✅ 页面内容充足');
          
          // 检查是否包含有效的中文内容
          const chineseMatch = content.match(/[\u4e00-\u9fa5]+/g);
          if (chineseMatch && chineseMatch.length > 10) {
            console.log('✅ 包含丰富的中文内容');
            
            // 显示部分内容
            const textContent = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            console.log('\n📖 内容预览:');
            console.log(textContent.substring(0, 300) + '...');
            
            console.log('\n🎉 HTTP请求测试成功！网站可以正常访问');
            console.log('\n💡 结论: ERR_BLOCKED_BY_CLIENT是Puppeteer特有的问题，不是网站的反爬机制');
            console.log('建议: 使用HTTP请求库（如axios）替代Puppeteer进行数据抓取');
            
            return true;
          } else {
            console.log('⚠️  中文内容较少，可能是错误页面');
          }
        } else {
          console.log('⚠️  页面内容较少');
        }
      } else {
        console.log('⚠️  响应不是HTML页面');
        console.log('响应内容预览:', content.substring(0, 200));
      }
    }
  } else {
    console.log('❌ 目标页面访问失败:', targetResult.error);
  }
  
  console.log('\n🏁 HTTP请求测试完成');
  return false;
}

main().then(success => {
  console.log('\n📊 最终结果:', success ? '✅ 成功' : '❌ 失败');
  
  if (success) {
    console.log('\n🚀 下一步行动:');
    console.log('1. 修改爬虫服务，使用HTTP请求替代Puppeteer');
    console.log('2. 实施HTML解析和内容提取');
    console.log('3. 添加更高级的反爬虫策略');
  } else {
    console.log('\n💡 故障排除建议:');
    console.log('1. 检查网络连接和DNS设置');
    console.log('2. 确认防火墙和安全软件设置');
    console.log('3. 尝试不同的网络环境');
  }
  
  process.exit(success ? 0 : 1);
});