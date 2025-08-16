import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// 模拟DOM环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window as any;
global.document = dom.window.document;

/**
 * 测试表单组件和样式改进
 */
class FormComponentTester {
  private testResults: Array<{ test: string; passed: boolean; message: string }> = [];

  /**
   * 检查表单组件文件是否存在
   */
  async testFormComponentsExist(): Promise<void> {
    console.log('\n=== 测试表单组件文件存在性 ===');
    
    const componentFiles = [
      'src/components/forms/FormInput.tsx',
      'src/components/forms/FormSelect.tsx', 
      'src/components/forms/FormCheckbox.tsx',
      'src/components/forms/FormTextarea.tsx',
      'src/components/forms/FormButton.tsx'
    ];

    for (const file of componentFiles) {
      const filePath = path.join(process.cwd(), file);
      const exists = fs.existsSync(filePath);
      
      this.testResults.push({
        test: `表单组件文件存在: ${file}`,
        passed: exists,
        message: exists ? '✓ 文件存在' : '✗ 文件不存在'
      });
      
      console.log(`${exists ? '✓' : '✗'} ${file}`);
    }
  }

  /**
   * 检查样式系统文件
   */
  async testStyleSystem(): Promise<void> {
    console.log('\n=== 测试统一样式系统 ===');
    
    const styleFile = 'src/styles/common.ts';
    const filePath = path.join(process.cwd(), styleFile);
    const exists = fs.existsSync(filePath);
    
    this.testResults.push({
      test: '统一样式系统文件存在',
      passed: exists,
      message: exists ? '✓ common.ts 存在' : '✗ common.ts 不存在'
    });
    
    console.log(`${exists ? '✓' : '✗'} ${styleFile}`);
    
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 检查关键样式导出
      const requiredExports = [
        'pageStyles',
        'textStyles', 
        'buttonStyles',
        'formStyles',
        'statusStyles',
        'layoutStyles',
        'iconStyles',
        'combineStyles'
      ];
      
      for (const exportName of requiredExports) {
        const hasExport = content.includes(`export const ${exportName}`);
        this.testResults.push({
          test: `样式导出: ${exportName}`,
          passed: hasExport,
          message: hasExport ? '✓ 导出存在' : '✗ 导出缺失'
        });
        
        console.log(`  ${hasExport ? '✓' : '✗'} ${exportName}`);
      }
    }
  }

  /**
   * 检查页面中表单组件的使用情况
   */
  async testFormComponentUsage(): Promise<void> {
    console.log('\n=== 测试表单组件使用情况 ===');
    
    const pageFiles = [
      'src/pages/Home.tsx',
      'src/pages/Batch.tsx',
      'src/pages/Settings.tsx'
    ];
    
    const formComponents = [
      'FormInput',
      'FormSelect',
      'FormCheckbox', 
      'FormTextarea',
      'FormButton'
    ];

    for (const pageFile of pageFiles) {
      const filePath = path.join(process.cwd(), pageFile);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查是否导入了表单组件
        const hasFormImport = content.includes('from \'../components/forms\'');
        
        this.testResults.push({
          test: `${pageFile} 导入表单组件`,
          passed: hasFormImport,
          message: hasFormImport ? '✓ 已导入表单组件' : '✗ 未导入表单组件'
        });
        
        console.log(`${hasFormImport ? '✓' : '✗'} ${pageFile} - 表单组件导入`);
        
        // 检查具体组件使用
        for (const component of formComponents) {
          const usesComponent = content.includes(`<${component}`);
          if (usesComponent) {
            console.log(`    ✓ 使用了 ${component}`);
          }
        }
      }
    }
  }

  /**
   * 检查样式统一性
   */
  async testStyleConsistency(): Promise<void> {
    console.log('\n=== 测试样式统一性 ===');
    
    const pageFiles = [
      'src/pages/Home.tsx',
      'src/pages/Batch.tsx', 
      'src/pages/Settings.tsx',
      'src/pages/Results.tsx'
    ];

    for (const pageFile of pageFiles) {
      const filePath = path.join(process.cwd(), pageFile);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查是否使用了统一样式系统
        const usesCommonStyles = content.includes('from \'../styles/common\'');
        const usesCombineStyles = content.includes('combineStyles');
        
        this.testResults.push({
          test: `${pageFile} 使用统一样式`,
          passed: usesCommonStyles,
          message: usesCommonStyles ? '✓ 使用统一样式系统' : '✗ 未使用统一样式系统'
        });
        
        console.log(`${usesCommonStyles ? '✓' : '✗'} ${pageFile} - 统一样式系统`);
        
        if (usesCombineStyles) {
          console.log(`    ✓ 使用了 combineStyles 函数`);
        }
      }
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 开始测试表单组件和样式改进...');
    
    await this.testFormComponentsExist();
    await this.testStyleSystem();
    await this.testFormComponentUsage();
    await this.testStyleConsistency();
    
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
    
    if (successRate === 100) {
      console.log('\n🎉 所有表单组件和样式改进测试通过！');
    } else {
      console.log('\n⚠️  部分测试失败，请检查以下问题:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
  }
}

// 运行测试
const tester = new FormComponentTester();
tester.runAllTests().catch(console.error);