import axios from 'axios';

// 测试单URL爬取功能
async function testSingleUrlCrawl() {
  console.log('🧪 开始测试单URL爬取功能...');
  
  const testUrl = 'https://www.gov.cn/xinwen/';
  const testTitle = '政府新闻测试';
  
  try {
    console.log(`📡 测试URL: ${testUrl}`);
    console.log(`📝 测试标题: ${testTitle}`);
    
    // 发送爬取请求
    const response = await axios.post('http://localhost:3000/api/tasks/create', {
      url: testUrl,
      title: testTitle,
      settings: {
        includeImages: false,
        timeout: 30000,
        generatePdf: true
      }
    });
    
    console.log('✅ 爬取请求发送成功');
    console.log('📊 完整响应:', response.data);
    
    const taskId = response.data.data?.taskId;
    const status = response.data.data?.status;
    const message = response.data.data?.message;
    
    console.log('📊 解析数据:', {
      taskId,
      status,
      message
    });
    
    // 等待一段时间后检查任务状态
    if (taskId) {
      console.log('⏳ 等待5秒后检查任务状态...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await axios.get(`http://localhost:3000/api/tasks/status/${taskId}`);
      console.log('📊 完整状态响应:', statusResponse.data);
      
      const taskData = statusResponse.data.data;
      console.log('📋 任务状态:', {
        id: taskData?.taskId,
        status: taskData?.status,
        url: taskData?.url,
        title: taskData?.title,
        createdAt: taskData?.createdAt
      });
      
      if (taskData?.status === 'completed') {
        console.log('🎉 单URL爬取测试成功完成!');
      } else if (taskData?.status === 'failed') {
        console.log('❌ 任务执行失败:', taskData?.errorMessage);
      } else {
        console.log('⏳ 任务仍在处理中，状态:', taskData?.status);
      }
    }
    
  } catch (error: any) {
    console.error('❌ 单URL爬取测试失败:');
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
testSingleUrlCrawl().catch(console.error);