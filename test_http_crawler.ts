import { httpCrawlerService } from './api/services/httpCrawler';

async function testHttpCrawler() {
  console.log('=== HTTP爬虫服务测试 ===');
  
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  console.log(`\n测试目标: ${testUrl}`);
  console.log('开始爬取...');
  
  const startTime = Date.now();
  
  try {
    const result = await httpCrawlerService.crawlPage(testUrl, {
      includeImages: true,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n=== 爬取结果 ===');
    console.log(`耗时: ${duration}ms`);
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
        const preview = result.content.substring(0, 500);
        console.log(preview);
        if (result.content.length > 500) {
          console.log('...(内容已截断)');
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
      const keywords = ['中国人民银行', '条法司', '规章制度', '法律法规'];
      const foundKeywords = keywords.filter(keyword => 
        result.content?.includes(keyword) || result.title?.includes(keyword)
      );
      
      if (foundKeywords.length > 0) {
        console.log(`✅ 找到关键词: ${foundKeywords.join(', ')}`);
      } else {
        console.log('⚠️  未找到预期关键词');
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
testHttpCrawler().catch(console.error);