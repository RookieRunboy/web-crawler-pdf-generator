import { CrawlerService } from './api/services/crawler';
import { supabase } from './api/lib/supabase';

/**
 * 最终集成测试
 * 验证升级后的爬虫服务在实际环境中的表现
 */
async function testFinalIntegration() {
  console.log('=== 最终集成测试 ===');
  console.log('测试升级后的爬虫服务...');
  
  const crawlerService = new CrawlerService();
  const testUrl = 'http://www.pbc.gov.cn/tiaofasi/144941/3581332/5670391/index.html';
  
  try {
    console.log(`\n目标URL: ${testUrl}`);
    console.log('开始爬取...');
    
    const startTime = Date.now();
    
    // 使用HTTP爬虫模式
    const result = await crawlerService.crawlPageWithHttp(testUrl);
    
    const endTime = Date.now();
    
    console.log('\n=== 爬取结果 ===');
    if (result.success) {
      console.log(`✅ 爬取成功!`);
      console.log(`耗时: ${endTime - startTime}ms`);
      console.log(`状态码: ${result.statusCode || 'N/A'}`);
      console.log(`标题: ${result.title}`);
      console.log(`内容长度: ${result.content.length} 字符`);
      console.log(`图片数量: ${result.images.length}`);
      console.log(`链接数量: ${result.links.length}`);
      
      console.log('\n内容预览:');
      console.log(result.content.substring(0, 300) + '...');
      
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
      
      // 测试数据质量
      const contentQuality = {
        hasTitle: !!result.title && result.title.length > 0,
        hasContent: result.content.length > 100,
        hasChinese: hasChinese,
        hasKeywords: foundKeywords.length > 0,
        hasImages: result.images.length > 0,
        hasLinks: result.links.length > 0
      };
      
      const qualityScore = Object.values(contentQuality).filter(Boolean).length;
      console.log(`\n数据质量评分: ${qualityScore}/6`);
      console.log('质量检查:', contentQuality);
      
      if (qualityScore >= 4) {
        console.log('\n🎉 爬虫升级成功！数据质量良好');
      } else {
        console.log('\n⚠️  数据质量需要进一步优化');
      }
      
    } else {
      console.log(`❌ 爬取失败: ${result.error}`);
    }
    
  } catch (error: any) {
    console.error('测试过程中发生错误:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testFinalIntegration().catch(console.error);