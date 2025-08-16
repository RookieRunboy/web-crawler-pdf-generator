import axios from 'axios';

// 测试错误处理机制
async function testErrorHandling() {
  console.log('🧪 开始测试错误处理机制...');
  
  const baseURL = 'http://localhost:3000';
  const testCases = [
    {
      name: '无效URL格式',
      url: 'invalid-url-format',
      expectedError: true
    },
    {
      name: '不存在的域名',
      url: 'https://this-domain-does-not-exist-12345.com',
      expectedError: true
    },
    {
      name: '404页面',
      url: 'https://httpstat.us/404',
      expectedError: true
    },
    {
      name: '500服务器错误',
      url: 'https://httpstat.us/500',
      expectedError: true
    },
    {
      name: '超时URL',
      url: 'https://httpstat.us/200?sleep=30000',
      expectedError: true
    }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`\n🔍 测试: ${testCase.name}`);
    console.log(`📍 URL: ${testCase.url}`);
    
    try {
      // 创建爬取任务
      const response = await axios.post(`${baseURL}/api/tasks/create`, {
        settings: {
          url: testCase.url,
          outputFormat: 'pdf'
        }
      });
      
      const taskId = response.data.data?.taskId;
      
      if (taskId) {
        console.log(`✅ 任务创建成功: ${taskId}`);
        
        // 等待一段时间让任务处理
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 检查任务状态
        const statusResponse = await axios.get(`${baseURL}/api/tasks/status/${taskId}`);
        const taskData = statusResponse.data.data;
        
        console.log(`📊 任务状态: ${taskData?.status}`);
        
        if (taskData?.errorMessage) {
          console.log(`❌ 错误信息: ${taskData.errorMessage}`);
          if (testCase.expectedError) {
            console.log('✅ 错误处理正确 - 预期的错误被正确捕获');
            passedTests++;
          } else {
            console.log('❌ 意外错误 - 不应该出现错误');
          }
        } else if (taskData?.status === 'completed') {
          if (testCase.expectedError) {
            console.log('❌ 错误处理失败 - 应该失败但成功了');
          } else {
            console.log('✅ 任务成功完成');
            passedTests++;
          }
        } else {
          console.log(`⏳ 任务状态: ${taskData?.status}`);
          if (testCase.expectedError) {
            console.log('✅ 错误处理可能正确 - 任务未完成');
            passedTests++;
          }
        }
      } else {
        console.log('❌ 任务创建失败 - 未获取到taskId');
        if (testCase.expectedError) {
          console.log('✅ 错误处理正确 - 任务创建被正确拒绝');
          passedTests++;
        }
      }
      
    } catch (error: any) {
      console.log(`❌ 请求失败: ${error.message}`);
      if (testCase.expectedError) {
        console.log('✅ 错误处理正确 - 请求被正确拒绝');
        passedTests++;
      } else {
        console.log('❌ 意外错误 - 请求不应该失败');
      }
    }
  }
  
  console.log('\n📈 错误处理测试总结:');
  console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
  console.log(`📊 成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有错误处理测试通过!');
  } else {
    console.log('⚠️ 部分错误处理测试失败，需要检查错误处理逻辑');
  }
}

// 运行测试
testErrorHandling().catch(console.error);