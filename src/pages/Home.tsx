import React, { useState, useEffect } from 'react';
import { Globe, Settings, Download, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';

const Home: React.FC = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    currentTask,
    isLoading,
    error,
    settings,
    createTask,
    clearError,
    clearCurrentTask,
    loadSettings,
    updateSettings
  } = useAppStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('请输入有效的URL');
      return;
    }
    
    // 简单的URL验证
    try {
      new URL(url);
    } catch {
      toast.error('请输入有效的URL格式');
      return;
    }
    
    await createTask(url.trim(), title.trim() || undefined);
  };

  const handleNewTask = () => {
    clearCurrentTask();
    setUrl('');
    setTitle('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待处理';
      case 'processing':
        return '正在爬取';
      case 'completed':
        return '完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Globe className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">网页爬虫PDF生成器</h1>
          </div>
          <p className="text-gray-600 text-lg">将任何网页转换为精美的PDF文档</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Input Form */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <Globe className="w-6 h-6 mr-2 text-blue-600" />
              创建爬取任务
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL Input */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                  网页URL *
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Title Input */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  自定义标题（可选）
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="为PDF文档设置自定义标题"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  disabled={isLoading}
                />
              </div>

              {/* Advanced Settings Toggle */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  高级设置
                </button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-medium text-gray-800">爬取设置</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.crawl.includeImages}
                          onChange={(e) => updateSettings({
                            crawl: { ...settings.crawl, includeImages: e.target.checked }
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
                        value={settings.crawl.timeout / 1000}
                        onChange={(e) => updateSettings({
                          crawl: { ...settings.crawl, timeout: parseInt(e.target.value) * 1000 }
                        })}
                        min="10"
                        max="300"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  <h3 className="font-medium text-gray-800 mt-4">PDF设置</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">页面格式</label>
                      <select
                        value={settings.pdf.format}
                        onChange={(e) => updateSettings({
                          pdf: { ...settings.pdf, format: e.target.value as any }
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">方向</label>
                      <select
                        value={settings.pdf.orientation}
                        onChange={(e) => updateSettings({
                          pdf: { ...settings.pdf, orientation: e.target.value as any }
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="portrait">纵向</option>
                        <option value="landscape">横向</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.pdf.includeImages}
                          onChange={(e) => updateSettings({
                            pdf: { ...settings.pdf, includeImages: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        PDF包含图片
                      </label>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.pdf.includeLinks}
                          onChange={(e) => updateSettings({
                            pdf: { ...settings.pdf, includeLinks: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        PDF包含链接
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    开始爬取
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Panel - Task Status */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">任务状态</h2>
            
            {currentTask ? (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800 truncate flex-1 mr-2">
                      {currentTask.title || currentTask.url}
                    </h3>
                    {getStatusIcon(currentTask.status)}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    <p><strong>URL:</strong> {currentTask.url}</p>
                    <p><strong>状态:</strong> {getStatusText(currentTask.status)}</p>
                    <p><strong>创建时间:</strong> {new Date(currentTask.createdAt).toLocaleString()}</p>
                  </div>
                  
                  {currentTask.errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mt-3">
                      <p className="text-red-700 text-sm">
                        <strong>错误:</strong> {currentTask.errorMessage}
                      </p>
                    </div>
                  )}
                  
                  {currentTask.contentPreview && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                      <p className="text-blue-700 text-sm">
                        <strong>内容预览:</strong> {currentTask.contentPreview.substring(0, 200)}...
                      </p>
                    </div>
                  )}
                  
                  {currentTask.status === 'completed' && currentTask.pdfAvailable && (
                    <button
                      onClick={() => {
                        if (currentTask.id) {
                          useAppStore.getState().downloadPDF(currentTask.id, currentTask.pdfFilename);
                        }
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center mt-3"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载PDF
                    </button>
                  )}
                </div>
                
                {(currentTask.status === 'completed' || currentTask.status === 'failed') && (
                  <button
                    onClick={handleNewTask}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    创建新任务
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Globe className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>暂无进行中的任务</p>
                <p className="text-sm mt-2">输入URL开始爬取网页内容</p>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Globe className="w-12 h-12 mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">智能爬取</h3>
            <p className="text-gray-600 text-sm">自动提取网页内容，支持复杂页面结构</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Download className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">高质量PDF</h3>
            <p className="text-gray-600 text-sm">生成格式化的PDF文档，保持原始布局</p>
          </div>
          
          <div className="bg-white rounded-lg p-6 text-center shadow-md">
            <Settings className="w-12 h-12 mx-auto mb-4 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">灵活配置</h3>
            <p className="text-gray-600 text-sm">自定义爬取和PDF生成参数</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;