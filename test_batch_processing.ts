import axios from 'axios';

// 测试批量处理功能
async function testBatchProcessing() {
  console.log('🧪 开始测试批量处理功能...');
  
  const testUrls = [
    { url: 'https://www.gov.cn/xinwen/', title: '政府新闻1' },
    { url: 'https://www.gov.cn/zhengce/', title: '政策文件' },
    { url: 'https://www.gov.cn/fuwu/', title: '政务服务' }
  ];
  
  const taskIds: string[] = [];
  
  try {
    console.log(`📊 准备批量处理 ${testUrls.length} 个URL`);
    
    // 批量创建任务
    for (const [index, { url, title }] of testUrls.entries()) {
      console.log(`\n📡 创建任务 ${index + 1}/${testUrls.length}`);
      console.log(`   URL: ${url}`);
      console.log(`   标题: ${title}`);
      
      const response = await axios.post('http://localhost:3000/api/tasks/create', {
        url,
        title,
        settings: {
          includeImages: false,
          timeout: 30000,
          generatePdf: true
        }
      });
      
      if (response.data.success) {
        const taskId = response.data.data.taskId;
        taskIds.push(taskId);
        console.log(`   ✅ 任务创建成功: ${taskId}`);
      } else {
        console.log(`   ❌ 任务创建失败`);
      }
      
      // 添加短暂延迟避免过快请求
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📋 已创建 ${taskIds.length} 个任务，等待10秒后检查状态...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 检查所有任务状态
    console.log('\n🔍 检查批量任务状态:');
    let completedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    
    for (const [index, taskId] of taskIds.entries()) {
      try {
        const statusResponse = await axios.get(`http://localhost:3000/api/tasks/status/${taskId}`);
        const taskData = statusResponse.data.data;
        
        console.log(`\n📋 任务 ${index + 1}:`);
        console.log(`   ID: ${taskData.taskId}`);
        console.log(`   URL: ${taskData.url}`);
        console.log(`   状态: ${taskData.status}`);
        console.log(`   标题: ${taskData.title}`);
        
        if (taskData.status === 'completed') {
          completedCount++;
          console.log(`   ✅ 任务完成`);
          if (taskData.pdfAvailable) {
            console.log(`   📄 PDF已生成`);
          }
        } else if (taskData.status === 'failed') {
          failedCount++;
          console.log(`   ❌ 任务失败: ${taskData.errorMessage}`);
        } else {
          pendingCount++;
          console.log(`   ⏳ 任务处理中`);
        }
      } catch (error) {
        console.log(`   ❌ 状态查询失败: ${taskId}`);
        failedCount++;
      }
    }
    
    // 输出批量处理结果统计
    console.log('\n📊 批量处理结果统计:');
    console.log(`   总任务数: ${taskIds.length}`);
    console.log(`   已完成: ${completedCount}`);
    console.log(`   失败: ${failedCount}`);
    console.log(`   处理中: ${pendingCount}`);
    
    const successRate = (completedCount / taskIds.length * 100).toFixed(1);
    console.log(`   成功率: ${successRate}%`);
    
    if (completedCount === taskIds.length) {
      console.log('\n🎉 批量处理测试完全成功!');
    } else if (completedCount > 0) {
      console.log('\n⚠️ 批量处理部分成功');
    } else {
      console.log('\n❌ 批量处理测试失败');
    }
    
  } catch (error: any) {
    console.error('❌ 批量处理测试失败:');
    if (error.response) {
      console.error('响应错误:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('请求错误:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
  }
}

// 运行测试
testBatchProcessing().catch(console.error);