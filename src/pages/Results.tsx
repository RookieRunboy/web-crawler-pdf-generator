import React, { useEffect, useState } from 'react';
import { Download, Clock, CheckCircle, AlertCircle, Trash2, Eye, ArrowLeft, Filter } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const Results: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const {
    taskHistory,
    historyLoading,
    historyPagination,
    error,
    loadTaskHistory,
    deleteTask,
    downloadPDF,
    clearError
  } = useAppStore();

  useEffect(() => {
    loadTaskHistory(1, statusFilter === 'all' ? undefined : statusFilter);
  }, [loadTaskHistory, statusFilter]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadTaskHistory(page, statusFilter === 'all' ? undefined : statusFilter);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleDelete = async (taskId: string) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      await deleteTask(taskId);
      toast.success('任务已删除');
    }
  };

  const handleDownload = async (taskId: string, filename?: string) => {
    try {
      await downloadPDF(taskId, filename);
      toast.success('PDF下载成功');
    } catch (error) {
      toast.error('下载失败');
    }
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
        return '正在处理';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderPagination = () => {
    const { page, totalPages } = historyPagination;
    const pages = [];
    
    // 显示页码范围
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-colors ${
            i === page
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          {i}
        </button>
      );
    }
    
    return (
      <div className="flex items-center justify-center mt-6">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-2 mx-1 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        
        {pages}
        
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-2 mx-1 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">任务历史</h1>
            <p className="text-gray-600">查看和管理您的爬取任务</p>
          </div>
          
          <Link
            to="/"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">筛选状态:</span>
            
            <div className="flex space-x-2">
              {[
                { value: 'all', label: '全部' },
                { value: 'pending', label: '等待中' },
                { value: 'processing', label: '处理中' },
                { value: 'completed', label: '已完成' },
                { value: 'failed', label: '失败' }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => handleStatusFilterChange(filter.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-lg shadow-md">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-600">加载中...</span>
            </div>
          ) : taskHistory.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">暂无任务记录</h3>
              <p className="text-gray-600 mb-4">您还没有创建任何爬取任务</p>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建第一个任务
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {taskHistory.map((task) => (
                <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        {getStatusIcon(task.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(task.status)}`}>
                          {getStatusText(task.status)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(task.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-medium text-gray-800 mb-1 truncate">
                        {task.title || '未命名任务'}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mb-2 break-all">
                        <strong>URL:</strong> {task.url}
                      </p>
                      
                      {task.errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                          <p className="text-red-700 text-sm">
                            <strong>错误:</strong> {task.errorMessage}
                          </p>
                        </div>
                      )}
                      
                      {task.contentPreview && (
                        <div className="bg-gray-50 rounded p-2 mb-2">
                          <p className="text-gray-700 text-sm">
                            <strong>内容预览:</strong> {task.contentPreview.substring(0, 150)}...
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {task.status === 'completed' && task.pdfAvailable && (
                        <button
                          onClick={() => handleDownload(task.id, task.pdfFilename)}
                          className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          title="下载PDF"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          下载
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        title="删除任务"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!historyLoading && taskHistory.length > 0 && historyPagination.totalPages > 1 && renderPagination()}

        {/* Summary */}
        {!historyLoading && (
          <div className="mt-6 text-center text-sm text-gray-600">
            共 {historyPagination.total} 个任务，第 {historyPagination.page} / {historyPagination.totalPages} 页
          </div>
        )}
      </div>
    </div>
  );
};

export default Results;