import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, ArrowLeft, Globe, FileText, Sliders } from 'lucide-react';
import { useAppStore, AppSettings } from '../store/useAppStore';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const {
    settings,
    settingsLoading,
    error,
    loadSettings,
    updateSettings,
    resetSettings,
    clearError
  } = useAppStore();

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSettingChange = (section: keyof AppSettings, key: string, value: any) => {
    const newSettings = {
      ...localSettings,
      [section]: {
        ...localSettings[section],
        [key]: value
      }
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleMarginChange = (side: string, value: string) => {
    const newSettings = {
      ...localSettings,
      pdf: {
        ...localSettings.pdf,
        margin: {
          ...localSettings.pdf.margin,
          [side]: value
        }
      }
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings(localSettings);
      setHasChanges(false);
      toast.success('设置已保存');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleReset = async () => {
    if (window.confirm('确定要重置所有设置为默认值吗？')) {
      try {
        await resetSettings();
        setHasChanges(false);
        toast.success('设置已重置');
      } catch (error) {
        toast.error('重置失败');
      }
    }
  };

  const handleDiscard = () => {
    setLocalSettings(settings);
    setHasChanges(false);
    toast.info('已放弃更改');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
              <SettingsIcon className="w-8 h-8 mr-3 text-blue-600" />
              应用设置
            </h1>
            <p className="text-gray-600">配置爬取和PDF生成参数</p>
          </div>
          
          <Link
            to="/"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Link>
        </div>

        {/* Settings Form */}
        <div className="space-y-6">
          {/* Crawl Settings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Globe className="w-6 h-6 mr-2 text-blue-600" />
              爬取设置
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.crawl.includeImages}
                    onChange={(e) => handleSettingChange('crawl', 'includeImages', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700 font-medium">包含图片</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">爬取页面时是否包含图片内容</p>
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">最大页面数</label>
                <input
                  type="number"
                  value={localSettings.crawl.maxPages}
                  onChange={(e) => handleSettingChange('crawl', 'maxPages', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">单次爬取的最大页面数量</p>
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">超时时间（秒）</label>
                <input
                  type="number"
                  value={localSettings.crawl.timeout / 1000}
                  onChange={(e) => handleSettingChange('crawl', 'timeout', parseInt(e.target.value) * 1000)}
                  min="10"
                  max="300"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">页面加载超时时间</p>
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">用户代理</label>
                <select
                  value={localSettings.crawl.userAgent}
                  onChange={(e) => handleSettingChange('crawl', 'userAgent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36">Chrome (Windows)</option>
                  <option value="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36">Chrome (macOS)</option>
                  <option value="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36">Chrome (Linux)</option>
                  <option value="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15">Safari (iPhone)</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">模拟的浏览器类型</p>
              </div>
            </div>
          </div>

          {/* PDF Settings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-green-600" />
              PDF设置
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">页面格式</label>
                <select
                  value={localSettings.pdf.format}
                  onChange={(e) => handleSettingChange('pdf', 'format', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                  <option value="Tabloid">Tabloid</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">页面方向</label>
                <select
                  value={localSettings.pdf.orientation}
                  onChange={(e) => handleSettingChange('pdf', 'orientation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.pdf.includeImages}
                    onChange={(e) => handleSettingChange('pdf', 'includeImages', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700 font-medium">包含图片</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">PDF中是否包含图片</p>
              </div>
              
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.pdf.includeLinks}
                    onChange={(e) => handleSettingChange('pdf', 'includeLinks', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700 font-medium">包含链接</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">PDF中是否保留可点击链接</p>
              </div>
            </div>
            
            {/* Margins */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">页边距设置</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">上边距</label>
                  <input
                    type="text"
                    value={localSettings.pdf.margin.top}
                    onChange={(e) => handleMarginChange('top', e.target.value)}
                    placeholder="20mm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">右边距</label>
                  <input
                    type="text"
                    value={localSettings.pdf.margin.right}
                    onChange={(e) => handleMarginChange('right', e.target.value)}
                    placeholder="15mm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">下边距</label>
                  <input
                    type="text"
                    value={localSettings.pdf.margin.bottom}
                    onChange={(e) => handleMarginChange('bottom', e.target.value)}
                    placeholder="20mm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">左边距</label>
                  <input
                    type="text"
                    value={localSettings.pdf.margin.left}
                    onChange={(e) => handleMarginChange('left', e.target.value)}
                    placeholder="15mm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">支持单位：mm, cm, in, px</p>
            </div>
          </div>

          {/* General Settings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Sliders className="w-6 h-6 mr-2 text-purple-600" />
              通用设置
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.general.autoDownload}
                    onChange={(e) => handleSettingChange('general', 'autoDownload', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700 font-medium">自动下载</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">任务完成后自动下载PDF</p>
              </div>
              
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={localSettings.general.deleteAfterDownload}
                    onChange={(e) => handleSettingChange('general', 'deleteAfterDownload', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700 font-medium">下载后删除</span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">下载PDF后自动删除任务记录</p>
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">最大历史记录数</label>
                <input
                  type="number"
                  value={localSettings.general.maxHistoryItems}
                  onChange={(e) => handleSettingChange('general', 'maxHistoryItems', parseInt(e.target.value))}
                  min="10"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">保留的最大任务历史记录数量</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-between bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="text-orange-600 font-medium">您有未保存的更改</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            {hasChanges && (
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                放弃更改
              </button>
            )}
            
            <button
              onClick={handleReset}
              disabled={settingsLoading}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重置默认
            </button>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || settingsLoading}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {settingsLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;