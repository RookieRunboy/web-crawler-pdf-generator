import { crawlerService } from './api/services/crawler';

async function testIntegratedHttpCrawler() {
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  console.log('=== 测试集成HTTP爬虫服务 ===');
  console.log(`目标URL: ${testUrl}`);
  console.log('开始爬取...');
  
  const startTime = Date.now();
  
  try {
    // 使用HTTP爬虫模式
    const settings = {
      useHttpCrawler: true,
      timeout: 30000
    };
    
    // 模拟任务ID
    const taskId = 'test-task-' + Date.now();
    
    // 直接调用HTTP爬虫方法进行测试
    const result = await (crawlerService as any).crawlPageWithHttp(testUrl, settings);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n=== 爬取结果 ===');
    console.log(`耗时: ${duration}ms`);
    console.log(`成功: ${result.success}`);
    
    if (result.success) {
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
testIntegratedHttpCrawler().catch(console.error);