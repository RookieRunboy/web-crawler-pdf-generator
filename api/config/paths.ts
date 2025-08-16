import path from 'path';
import fs from 'fs';

/**
 * 路径配置管理器
 * 统一管理所有硬编码路径，支持环境变量配置
 */
export class PathConfig {
  private static instance: PathConfig;
  
  // 基础路径
  public readonly rootDir: string;
  public readonly tempDir: string;
  public readonly pdfsDir: string;
  public readonly inputExcelDir: string;
  public readonly downloadsDir: string;
  public readonly pythonScriptsDir: string;
  
  private constructor() {
    this.rootDir = process.cwd();
    
    // 从环境变量读取路径配置，提供默认值
    this.tempDir = path.join(this.rootDir, process.env.TEMP_DIR || 'temp');
    this.pdfsDir = path.join(this.rootDir, process.env.PDFS_DIR || 'temp/pdfs');
    this.inputExcelDir = path.join(this.rootDir, process.env.INPUT_EXCEL_DIR || 'inputexcel');
    this.downloadsDir = path.join(this.rootDir, process.env.DOWNLOADS_DIR || 'downloads');
    this.pythonScriptsDir = path.join(this.rootDir, process.env.PYTHON_SCRIPTS_DIR || 'api/python_scripts');
    
    // 确保必要的目录存在
    this.ensureDirectoriesExist();
  }
  
  public static getInstance(): PathConfig {
    if (!PathConfig.instance) {
      PathConfig.instance = new PathConfig();
    }
    return PathConfig.instance;
  }
  
  /**
   * 确保所有必要的目录存在
   */
  private ensureDirectoriesExist(): void {
    const directories = [
      this.tempDir,
      this.pdfsDir,
      this.inputExcelDir,
      this.downloadsDir
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * 获取Excel批处理输出目录
   */
  public getExcelBatchOutputDir(batchId: string): string {
    return path.join(this.tempDir, 'excel_batch', batchId);
  }
  
  /**
   * 获取批处理下载目录
   */
  public getBatchDownloadDir(): string {
    return path.join(this.downloadsDir, 'batch');
  }
  
  /**
   * 获取Excel批处理下载目录
   */
  public getExcelBatchDownloadDir(): string {
    return path.join(this.downloadsDir, 'excel_batch');
  }
  
  /**
   * 获取Python脚本路径
   */
  public getPythonScriptPath(scriptName: string): string {
    return path.join(this.pythonScriptsDir, scriptName);
  }
  
  /**
   * 获取PDF文件路径
   */
  public getPdfFilePath(filename: string): string {
    return path.join(this.pdfsDir, filename);
  }
  
  /**
   * 检查文件是否存在
   */
  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
  
  /**
   * 创建目录（如果不存在）
   */
  public ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// 导出单例实例
export const pathConfig = PathConfig.getInstance();