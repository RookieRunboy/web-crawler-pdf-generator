import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw,
  Trash2,
  Eye,
  ExternalLink
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { formatDuration, getStatusColor, getStatusText, calculateProgress } from '../utils/batchUtils';

interface BatchTask {
  id: string;
  title: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
  pdf_filename?: string;
  pdf_path?: string;
}

interface BatchStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  zip_filename?: string;
  zip_path?: string;
  created_at: string;
  completed_at?: string;
  tasks: BatchTask[];
}

const BatchResult: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTask, setSelectedTask] = useState<BatchTask | null>(null);

  // 获取批量任务状态
  const fetchBatchStatus = async () => {
    if (!batchId) return;
    
    try {
      const response = await fetch(`/api/batch/status/${batchId}`);
      if (!response.ok) {
        throw new Error('获取批量任务状态失败');
      }
      const data = await response.json();
      setBatchStatus(data);
      setError(null);
      
      // 如果任务已完成或失败，停止自动刷新
      if (data.status === 'completed' || data.status === 'failed') {
        setAutoRefresh(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  // 下载ZIP文件
  const downloadZip = async () => {
    if (!batchId || !batchStatus?.zip_filename) return;
    
    try {
      const response = await fetch(`/api/batch/download/${batchId}`);
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = batchStatus.zip_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('下载开始');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '下载失败');
    }
  };

  // 下载单个PDF
  const downloadPdf = async (task: BatchTask) => {
    if (!task.pdf_filename || task.status !== 'completed') return;
    
    try {
      const response = await fetch(`/api/tasks/download/${task.id}`);
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.pdf_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('下载开始');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '下载失败');
    }
  };

  // 删除批量任务
  const deleteBatch = async () => {
    if (!batchId) return;
    
    if (!confirm('确定要删除这个批量任务吗？这将删除所有相关的PDF文件。')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/batch/${batchId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除失败');
      }
      
      toast.success('批量任务已删除');
      navigate('/batch');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  useEffect(() => {
    fetchBatchStatus();
  }, [batchId]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchBatchStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, batchId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !batchStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || '批量任务不存在'}</p>
          <button
            onClick={() => navigate('/batch')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            返回批量页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/batch')}
              className="mr-4 p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{batchStatus.name}</h1>
              <p className="text-gray-600">批量任务详情</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {autoRefresh ? '自动刷新' : '手动刷新'}
            </button>
            
            <button
              onClick={fetchBatchStatus}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            <button
              onClick={deleteBatch}
              className="p-2 text-red-600 hover:text-red-800 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Overall Status */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(batchStatus.status)}
                <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                  getStatusColor(batchStatus.status)
                }`}>
                  {getStatusText(batchStatus.status)}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {calculateProgress(batchStatus.completed_tasks, batchStatus.total_tasks)}%
              </div>
              <div className="text-sm text-gray-600">总体进度</div>
            </div>
            
            {/* Total Tasks */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {batchStatus.total_tasks}
              </div>
              <div className="text-sm text-gray-600">总任务数</div>
            </div>
            
            {/* Completed Tasks */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {batchStatus.completed_tasks}
              </div>
              <div className="text-sm text-gray-600">已完成</div>
            </div>
            
            {/* Failed Tasks */}
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {batchStatus.failed_tasks}
              </div>
              <div className="text-sm text-gray-600">失败</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>进度</span>
              <span>{batchStatus.completed_tasks + batchStatus.failed_tasks} / {batchStatus.total_tasks}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${batchStatus.progress}%` }}
              />
            </div>
          </div>
          
          {/* Download Button */}
          {batchStatus.status === 'completed' && batchStatus.zip_filename && (
            <div className="mt-6 text-center">
              <button
                onClick={downloadZip}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center mx-auto"
              >
                <Download className="w-5 h-5 mr-2" />
                下载所有PDF ({batchStatus.zip_filename})
              </button>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">任务列表</h2>
          
          <div className="space-y-3">
            {batchStatus.tasks.map((task) => (
              <div
                key={task.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-2">
                      {getStatusIcon(task.status)}
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        getStatusColor(task.status)
                      }`}>
                        {getStatusText(task.status)}
                      </span>
                      <span className="ml-3 font-medium text-gray-800 truncate">
                        {task.title}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors truncate"
                      >
                        {task.url}
                      </a>
                    </div>
                    
                    {task.error_message && (
                      <div className="text-sm text-red-600 bg-red-50 rounded p-2 mb-2">
                        {task.error_message}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      创建时间: {new Date(task.created_at).toLocaleString()}
                      {task.completed_at && (
                        <span className="ml-4">
                          耗时: {formatDuration(task.created_at, task.completed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {task.status === 'completed' && task.pdf_filename && (
                      <button
                        onClick={() => downloadPdf(task)}
                        className="p-2 text-green-600 hover:text-green-800 transition-colors"
                        title="下载PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Task Detail Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">任务详情</h3>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                    <div className="text-gray-900">{selectedTask.title}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <a
                      href={selectedTask.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {selectedTask.url}
                    </a>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <div className="flex items-center">
                      {getStatusIcon(selectedTask.status)}
                      <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                        getStatusColor(selectedTask.status)
                      }`}>
                        {getStatusText(selectedTask.status)}
                      </span>
                    </div>
                  </div>
                  
                  {selectedTask.pdf_filename && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PDF文件</label>
                      <div className="flex items-center justify-between bg-gray-50 rounded p-3">
                        <span className="text-gray-900">{selectedTask.pdf_filename}</span>
                        <button
                          onClick={() => downloadPdf(selectedTask)}
                          className="text-green-600 hover:text-green-800 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {selectedTask.error_message && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">错误信息</label>
                      <div className="text-red-600 bg-red-50 rounded p-3">
                        {selectedTask.error_message}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">创建时间</label>
                      <div className="text-gray-900">
                        {new Date(selectedTask.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    {selectedTask.completed_at && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">完成时间</label>
                        <div className="text-gray-900">
                          {new Date(selectedTask.completed_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchResult;