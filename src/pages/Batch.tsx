import React, { useState, useEffect } from 'react';
import { FileText, Upload, Settings, Download, Clock, AlertCircle, CheckCircle, Trash2, Eye } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { parseBatchData, validateBatchOptions } from '../utils/batchUtils';

interface ParsedTask {
  title: string;
  url: string;
  isValid: boolean;
  error?: string;
}

const Batch: React.FC = () => {
  const [batchData, setBatchData] = useState('');
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchOptions, setBatchOptions] = useState({
    includeImages: true,
    timeout: 30,
    concurrency: 3
  });
  
  const {
    currentBatch,
    isLoading,
    error,
    settings,
    createBatchTask,
    clearError,
    clearCurrentBatch,
    loadSettings,
    updateSettings
  } = useAppStore();

  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // 解析批量数据
  const parseData = (rawData: string): ParsedTask[] => {
    const parsed = parseBatchData(rawData);
    const results: ParsedTask[] = [];
    
    // 转换有效任务
    parsed.validTasks.forEach(task => {
      results.push({
        title: task.title,
        url: task.url,
        isValid: true
      });
    });
    
    // 转换无效任务
    parsed.invalidTasks.forEach(task => {
      results.push({
        title: task.title,
        url: task.url,
        isValid: false,
        error: task.error
      });
    });
    
    return results;
  };

  // 处理数据输入变化
  const handleDataChange = (value: string) => {
    setBatchData(value);
    if (value.trim()) {
      const parsed = parseData(value);
      setParsedTasks(parsed);
    } else {
      setParsedTasks([]);
    }
  };

  // 删除任务
  const removeTask = (index: number) => {
    const newTasks = parsedTasks.filter((_, i) => i !== index);
    setParsedTasks(newTasks);
    
    // 重新生成批量数据字符串
    const newBatchData = newTasks
      .filter(task => task.isValid)
      .map(task => `${task.title}\t${task.url}`)
      .join('\n');
    setBatchData(newBatchData);
  };

  // 提交批量任务
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!batchData.trim()) {
      toast.error('请输入批量数据');
      return;
    }
    
    const validTasks = parsedTasks.filter(task => task.isValid);
    if (validTasks.length === 0) {
      toast.error('没有有效的任务数据');
      return;
    }

    // 验证批量选项
    const validation = validateBatchOptions(batchOptions);
    if (!validation.valid) {
      toast.error(`配置错误: ${validation.errors.join(', ')}`);
      return;
    }
    
    const result = await createBatchTask(batchData, batchOptions);
    if (result?.batchId) {
      navigate(`/batch/${result.batchId}`);
    }
  };

  // 示例数据
  const exampleData = `网站首页\thttps://example.com
关于我们\thttps://example.com/about
产品介绍\thttps://example.com/products
联系方式\thttps://example.com/contact`;

  const validTasks = parsedTasks.filter(task => task.isValid);
  const invalidTasks = parsedTasks.filter(task => !task.isValid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-purple-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">批量爬取功能</h1>
          </div>
          <p className="text-gray-600 text-lg">批量处理多个网页，一次性生成多个PDF文档</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Panel - Input Form */}
          <div className="xl:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <Upload className="w-6 h-6 mr-2 text-purple-600" />
              批量数据输入
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Format Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">数据格式说明</h3>
                <p className="text-blue-700 text-sm mb-3">
                  请按照以下格式输入数据，每行一个任务，标题和链接之间用制表符（Tab）分隔：
                </p>
                <div className="bg-white rounded border p-3 font-mono text-sm">
                  <div className="text-gray-600">标题1&nbsp;&nbsp;&nbsp;&nbsp;https://example1.com</div>
                  <div className="text-gray-600">标题2&nbsp;&nbsp;&nbsp;&nbsp;https://example2.com</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDataChange(exampleData)}
                  className="mt-3 text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  使用示例数据
                </button>
              </div>

              {/* Batch Data Input */}
              <div>
                <label htmlFor="batchData" className="block text-sm font-medium text-gray-700 mb-2">
                  批量数据 *
                </label>
                <textarea
                  id="batchData"
                  value={batchData}
                  onChange={(e) => handleDataChange(e.target.value)}
                  placeholder="请粘贴从Excel复制的数据，或手动输入...\n\n格式：标题[Tab]链接"
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none font-mono text-sm"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Advanced Settings Toggle */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  批量设置
                </button>
                {validTasks.length > 0 && (
                  <span className="text-sm text-gray-600">
                    有效任务: {validTasks.length} 个
                  </span>
                )}
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-medium text-gray-800">批量处理设置</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={batchOptions.includeImages}
                          onChange={(e) => setBatchOptions({
                            ...batchOptions,
                            includeImages: e.target.checked
                          })}
                          className="mr-2"
                        />
                        包含图片
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">超时时间（秒）</label>
                      <input
                        type="number"
                        value={batchOptions.timeout}
                        onChange={(e) => setBatchOptions({
                          ...batchOptions,
                          timeout: parseInt(e.target.value) || 30
                        })}
                        min="5"
                        max="300"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">并发数量</label>
                      <input
                        type="number"
                        value={batchOptions.concurrency}
                        onChange={(e) => setBatchOptions({
                          ...batchOptions,
                          concurrency: Math.min(parseInt(e.target.value) || 3, 10)
                        })}
                        min="1"
                        max="10"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || validTasks.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    创建中...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    创建批量任务 ({validTasks.length}个)
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Panel - Task Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <Eye className="w-6 h-6 mr-2 text-purple-600" />
              任务预览
            </h2>
            
            {parsedTasks.length > 0 ? (
              <div className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{validTasks.length}</div>
                    <div className="text-sm text-green-700">有效任务</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{invalidTasks.length}</div>
                    <div className="text-sm text-red-700">无效任务</div>
                  </div>
                </div>

                {/* Task List */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {parsedTasks.map((task, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        task.isValid
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-1">
                            {task.isValid ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {task.title || '无标题'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {task.url || '无URL'}
                          </div>
                          {task.error && (
                            <div className="text-xs text-red-600 mt-1">
                              {task.error}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeTask(index)}
                          className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="删除任务"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>暂无任务数据</p>
                <p className="text-sm mt-2">请在左侧输入批量数据</p>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Upload className="w-12 h-12 mx-auto mb-4 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">批量输入</h3>
            <p className="text-gray-600 text-sm">支持Excel复制粘贴，快速导入大量任务</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Settings className="w-12 h-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">并发控制</h3>
            <p className="text-gray-600 text-sm">智能并发处理，提高效率同时保护服务器</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Download className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">批量下载</h3>
            <p className="text-gray-600 text-sm">自动打包所有PDF文件，一键下载</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Batch;