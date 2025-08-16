import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * 测试配置管理和环境变量使用
 */
class ConfigManagementTester {
  private testResults: Array<{ test: string; passed: boolean; message: string }> = [];

  /**
   * 检查环境变量配置文件
   */
  async testEnvironmentFiles(): Promise<void> {
    console.log('\n=== 测试环境变量配置文件 ===');
    
    const envFiles = [
      '.env.example',
      '.env.local',
      '.env'
    ];

    for (const file of envFiles) {
      const filePath = path.join(process.cwd(), file);
      const exists = fs.existsSync(filePath);
      
      this.testResults.push({
        test: `环境变量文件: ${file}`,
        passed: exists,
        message: exists ? '✓ 文件存在' : '✗ 文件不存在'
      });
      
      console.log(`${exists ? '✓' : '✗'} ${file}`);
      
      if (exists && file !== '.env') {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查关键环境变量
        const requiredVars = [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
          'VITE_SUPABASE_URL',
          'VITE_SUPABASE_ANON_KEY'
        ];
        
        for (const varName of requiredVars) {
          const hasVar = content.includes(varName);
          if (hasVar) {
            console.log(`    ✓ 包含 ${varName}`);
          }
        }
      }
    }
  }

  /**
   * 检查配置文件结构
   */
  async testConfigFiles(): Promise<void> {
    console.log('\n=== 测试配置文件结构 ===');
    
    const configFiles = [
      'api/config/paths.ts',
      'api/config/supabase.ts',
      'vite.config.ts',
      'tsconfig.json',
      'package.json'
    ];

    for (const file of configFiles) {
      const filePath = path.join(process.cwd(), file);
      const exists = fs.existsSync(filePath);
      
      this.testResults.push({
        test: `配置文件: ${file}`,
        passed: exists,
        message: exists ? '✓ 文件存在' : '✗ 文件不存在'
      });
      
      console.log(`${exists ? '✓' : '✗'} ${file}`);
    }
  }

  /**
   * 检查路径配置的使用
   */
  async testPathConfiguration(): Promise<void> {
    console.log('\n=== 测试路径配置使用 ===');
    
    const pathConfigFile = 'api/config/paths.ts';
    const filePath = path.join(process.cwd(), pathConfigFile);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 检查PathConfig类的关键方法
      const requiredMethods = [
        'ensureDirectoriesExist',
        'getInputExcelPath',
        'getOutputZipPath',
        'getTempDir'
      ];
      
      for (const method of requiredMethods) {
        const hasMethod = content.includes(method);
        this.testResults.push({
          test: `PathConfig方法: ${method}`,
          passed: hasMethod,
          message: hasMethod ? '✓ 方法存在' : '✗ 方法缺失'
        });
        
        console.log(`${hasMethod ? '✓' : '✗'} ${method}`);
      }
      
      // 检查路径配置的使用
      const apiFiles = [
        'api/routes/excel.ts',
        'api/python_scripts/excel_batch_processor.py'
      ];
      
      for (const apiFile of apiFiles) {
        const apiFilePath = path.join(process.cwd(), apiFile);
        if (fs.existsSync(apiFilePath)) {
          const apiContent = fs.readFileSync(apiFilePath, 'utf-8');
          const usesPathConfig = apiContent.includes('pathConfig') || apiContent.includes('PathConfig');
          
          console.log(`${usesPathConfig ? '✓' : '✗'} ${apiFile} - 使用路径配置`);
        }
      }
    }
  }

  /**
   * 检查环境变量在代码中的使用
   */
  async testEnvironmentVariableUsage(): Promise<void> {
    console.log('\n=== 测试环境变量使用情况 ===');
    
    const codeFiles = [
      'api/config/supabase.ts',
      'src/lib/supabase.ts',
      'vite.config.ts'
    ];

    for (const file of codeFiles) {
      const filePath = path.join(process.cwd(), file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查环境变量的使用
        const usesProcessEnv = content.includes('process.env');
        const usesImportMetaEnv = content.includes('import.meta.env');
        
        const usesEnvVars = usesProcessEnv || usesImportMetaEnv;
        
        this.testResults.push({
          test: `${file} 使用环境变量`,
          passed: usesEnvVars,
          message: usesEnvVars ? '✓ 使用环境变量' : '✗ 未使用环境变量'
        });
        
        console.log(`${usesEnvVars ? '✓' : '✗'} ${file} - 环境变量使用`);
        
        if (usesProcessEnv) {
          console.log(`    ✓ 使用 process.env`);
        }
        if (usesImportMetaEnv) {
          console.log(`    ✓ 使用 import.meta.env`);
        }
      }
    }
  }

  /**
   * 测试配置的有效性
   */
  async testConfigurationValidity(): Promise<void> {
    console.log('\n=== 测试配置有效性 ===');
    
    // 检查TypeScript配置
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        const hasCompilerOptions = tsconfig.compilerOptions !== undefined;
        
        this.testResults.push({
          test: 'TypeScript配置有效',
          passed: hasCompilerOptions,
          message: hasCompilerOptions ? '✓ 配置有效' : '✗ 配置无效'
        });
        
        console.log(`${hasCompilerOptions ? '✓' : '✗'} TypeScript配置`);
      } catch (error) {
        this.testResults.push({
          test: 'TypeScript配置解析',
          passed: false,
          message: '✗ JSON解析失败'
        });
        
        console.log('✗ TypeScript配置 - JSON解析失败');
      }
    }
    
    // 检查package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        const hasScripts = packageJson.scripts !== undefined;
        const hasDependencies = packageJson.dependencies !== undefined;
        
        this.testResults.push({
          test: 'package.json配置有效',
          passed: hasScripts && hasDependencies,
          message: (hasScripts && hasDependencies) ? '✓ 配置有效' : '✗ 配置不完整'
        });
        
        console.log(`${(hasScripts && hasDependencies) ? '✓' : '✗'} package.json配置`);
        
        if (hasScripts) {
          console.log('    ✓ 包含scripts配置');
        }
        if (hasDependencies) {
          console.log('    ✓ 包含dependencies配置');
        }
      } catch (error) {
        this.testResults.push({
          test: 'package.json解析',
          passed: false,
          message: '✗ JSON解析失败'
        });
        
        console.log('✗ package.json - JSON解析失败');
      }
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🔧 开始测试配置管理和环境变量使用...');
    
    await this.testEnvironmentFiles();
    await this.testConfigFiles();
    await this.testPathConfiguration();
    await this.testEnvironmentVariableUsage();
    await this.testConfigurationValidity();
    
    this.printSummary();
  }

  /**
   * 打印测试总结
   */
  private printSummary(): void {
    console.log('\n=== 测试总结 ===');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const successRate = Math.round((passed / total) * 100);
    
    console.log(`总测试数: ${total}`);
    console.log(`通过测试: ${passed}`);
    console.log(`失败测试: ${total - passed}`);
    console.log(`成功率: ${successRate}%`);
    
    if (successRate >= 80) {
      console.log('\n🎉 配置管理测试基本通过！');
    } else {
      console.log('\n⚠️  配置管理存在问题，请检查以下项目:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
  }
}

// 运行测试
const tester = new ConfigManagementTester();
tester.runAllTests().catch(console.error);