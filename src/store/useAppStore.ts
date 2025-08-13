import { create } from 'zustand';
import { apiClient, CrawlSettings, PDFSettings } from '../lib/api';

export interface Task {
  id: string;
  url: string;
  title?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  pdfAvailable?: boolean;
  pdfFilename?: string;
  contentPreview?: string;
  batchId?: string;
}

export interface BatchTask {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  zipFilename?: string;
  zipPath?: string;
  createdAt: string;
  completedAt?: string;
  tasks?: Task[];
}

export interface BatchOptions {
  includeImages: boolean;
  timeout: number;
  concurrency: number;
}

export interface AppSettings {
  crawl: CrawlSettings;
  pdf: PDFSettings;
  general: {
    autoDownload: boolean;
    deleteAfterDownload: boolean;
    maxHistoryItems: number;
  };
}

interface AppState {
  // 当前任务状态
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  
  // 任务历史
  taskHistory: Task[];
  historyLoading: boolean;
  historyPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  currentPage: number;
  statusFilter: string;
  
  // 批量操作状态
  selectedTaskIds: string[];
  batchOperationLoading: boolean;
  
  // 批量任务状态
  currentBatch: BatchTask | null;
  batchHistory: BatchTask[];
  batchLoading: boolean;
  batchPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // 应用设置
  settings: AppSettings;
  settingsLoading: boolean;
  
  // Actions
  createTask: (url: string, title?: string) => Promise<void>;
  pollTaskStatus: (taskId: string) => Promise<void>;
  downloadPDF: (taskId: string, filename?: string) => Promise<void>;
  loadTaskHistory: (page?: number, status?: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  
  // 批量操作Actions
  toggleTaskSelection: (taskId: string) => void;
  selectAllTasks: () => void;
  selectAllTasksFromAllPages: (status?: string) => Promise<void>;
  clearTaskSelection: () => void;
  deleteTasks: (taskIds: string[]) => Promise<void>;
  downloadMultiplePDFs: (taskIds: string[]) => Promise<{ downloadedCount: number; totalSelected: number }>;
  
  // Batch Actions
  createBatchTask: (batchData: string, options: BatchOptions) => Promise<{ batchId: string } | null>;
  loadBatchStatus: (batchId: string) => Promise<BatchTask | null>;
  loadBatchHistory: (page?: number, status?: string) => Promise<void>;
  deleteBatchTask: (batchId: string) => Promise<void>;
  downloadBatchZip: (batchId: string) => Promise<void>;
  
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  clearError: () => void;
  clearCurrentTask: () => void;
  clearCurrentBatch: () => void;
}

const defaultSettings: AppSettings = {
  crawl: {
    includeImages: true,
    maxPages: 1,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  pdf: {
    format: 'A4',
    orientation: 'portrait',
    includeImages: true,
    includeLinks: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  },
  general: {
    autoDownload: false,
    deleteAfterDownload: false,
    maxHistoryItems: 100
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  currentTask: null,
  isLoading: false,
  error: null,
  taskHistory: [],
  historyLoading: false,
  historyPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  },
  currentPage: 1,
  statusFilter: 'all',
  
  // 批量操作初始状态
  selectedTaskIds: [],
  batchOperationLoading: false,
  
  // 批量任务初始状态
  currentBatch: null,
  batchHistory: [],
  batchLoading: false,
  batchPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  },
  
  settings: defaultSettings,
  settingsLoading: false,

  // 创建任务
  createTask: async (url: string, title?: string) => {
    set({ isLoading: true, error: null, currentTask: null });
    
    try {
      const { settings } = get();
      const response = await apiClient.createTask({
        url,
        title,
        settings: {
          crawl: settings.crawl,
          pdf: settings.pdf
        }
      });
      
      if (response.success && response.data) {
        const task: Task = {
          id: response.data.taskId,
          url,
          title,
          status: response.data.status as Task['status'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        set({ currentTask: task, isLoading: false });
        
        // 开始轮询任务状态
        get().pollTaskStatus(response.data.taskId);
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      });
    }
  },

  // 轮询任务状态
  pollTaskStatus: async (taskId: string) => {
    try {
      const response = await apiClient.getTaskStatus(taskId);
      
      if (response.success && response.data) {
        const updatedTask: Task = {
          id: response.data.taskId,
          url: response.data.url || '',
          title: response.data.title,
          status: response.data.status as Task['status'],
          createdAt: response.data.createdAt || '',
          updatedAt: response.data.updatedAt || '',
          errorMessage: response.data.errorMessage,
          pdfAvailable: response.data.pdfAvailable,
          pdfFilename: response.data.pdfFilename,
          contentPreview: response.data.contentPreview
        };
        
        set({ currentTask: updatedTask });
        
        // 如果任务还在处理中，继续轮询
        if (updatedTask.status === 'pending' || updatedTask.status === 'processing') {
          setTimeout(() => {
            get().pollTaskStatus(taskId);
          }, 2000); // 每2秒轮询一次
        } else {
          // 任务完成，刷新历史记录
          get().loadTaskHistory();
          
          // 如果设置了自动下载且任务成功完成
          const { settings } = get();
          if (settings.general.autoDownload && updatedTask.status === 'completed' && updatedTask.pdfAvailable) {
            get().downloadPDF(taskId, updatedTask.pdfFilename);
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll task status:', error);
    }
  },

  // 下载PDF
  downloadPDF: async (taskId: string, filename?: string) => {
    try {
      const blob = await apiClient.downloadPDF(taskId);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `webpage_${taskId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // 如果设置了下载后删除
      const { settings } = get();
      if (settings.general.deleteAfterDownload) {
        await get().deleteTask(taskId);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Download failed' });
    }
  },

  // 加载任务历史
  loadTaskHistory: async (page = 1, status?: string) => {
    set({ historyLoading: true });
    
    try {
      const response = await apiClient.getTaskHistory(page, 20, status);
      
      if (response.success && response.data) {
        const tasks: Task[] = response.data.tasks.map(task => ({
          id: task.id,
          url: task.url,
          title: task.title,
          status: task.status as Task['status'],
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          errorMessage: task.error_message,
          pdfAvailable: !!task.pdf_filename,
          pdfFilename: task.pdf_filename
        }));
        
        set({ 
          taskHistory: tasks,
          historyPagination: response.data.pagination,
          currentPage: page,
          statusFilter: status || 'all',
          historyLoading: false 
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load history',
        historyLoading: false 
      });
    }
  },

  // 删除任务
  deleteTask: async (taskId: string) => {
    try {
      const response = await apiClient.deleteTask(taskId);
      
      if (response.success) {
        // 从历史记录中移除
        const { taskHistory } = get();
        set({ taskHistory: taskHistory.filter(task => task.id !== taskId) });
        
        // 如果删除的是当前任务，清除当前任务
        const { currentTask } = get();
        if (currentTask?.id === taskId) {
          set({ currentTask: null });
        }
      } else {
        throw new Error(response.error || 'Failed to delete task');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Delete failed' });
    }
  },

  // 加载设置
  loadSettings: async () => {
    set({ settingsLoading: true });
    
    try {
      const response = await apiClient.getSettings();
      
      if (response.success && response.data) {
        set({ 
          settings: {
            crawl: response.data.crawl_settings || defaultSettings.crawl,
            pdf: response.data.pdf_settings || defaultSettings.pdf,
            general: { ...defaultSettings.general, ...(response.data.general_settings || {}) }
          },
          settingsLoading: false 
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load settings',
        settingsLoading: false 
      });
    }
  },

  // 更新设置
  updateSettings: async (newSettings: Partial<AppSettings>) => {
    set({ settingsLoading: true });
    
    try {
      const { settings } = get();
      const updatedSettings = {
        ...settings,
        ...newSettings
      };
      
      const response = await apiClient.updateSettings({
        crawl_settings: updatedSettings.crawl,
        pdf_settings: updatedSettings.pdf,
        general_settings: updatedSettings.general
      });
      
      if (response.success) {
        set({ settings: updatedSettings, settingsLoading: false });
      } else {
        throw new Error(response.error || 'Failed to update settings');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update settings',
        settingsLoading: false 
      });
    }
  },

  // 重置设置
  resetSettings: async () => {
    set({ settingsLoading: true });
    
    try {
      const response = await apiClient.resetSettings();
      
      if (response.success) {
        set({ settings: defaultSettings, settingsLoading: false });
      } else {
        throw new Error(response.error || 'Failed to reset settings');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reset settings',
        settingsLoading: false 
      });
    }
  },

  // 创建批量任务
  createBatchTask: async (batchData: string, options: BatchOptions) => {
    set({ isLoading: true, error: null, currentBatch: null });
    
    try {
      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchData,
          options
        })
      });
      
      if (!response.ok) {
        throw new Error('创建批量任务失败');
      }
      
      const result = await response.json();
      
      if (result.success) {
        set({ isLoading: false });
        return { batchId: result.batchId };
      } else {
        throw new Error(result.error || '创建批量任务失败');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '创建批量任务失败',
        isLoading: false 
      });
      return null;
    }
  },

  // 加载批量任务状态
  loadBatchStatus: async (batchId: string) => {
    try {
      const response = await fetch(`/api/batch/status/${batchId}`);
      
      if (!response.ok) {
        throw new Error('获取批量任务状态失败');
      }
      
      const data = await response.json();
      
      const batchTask: BatchTask = {
        id: data.id,
        name: data.name,
        status: data.status,
        progress: data.progress,
        totalTasks: data.total_tasks,
        completedTasks: data.completed_tasks,
        failedTasks: data.failed_tasks,
        zipFilename: data.zip_filename,
        zipPath: data.zip_path,
        createdAt: data.created_at,
        completedAt: data.completed_at,
        tasks: data.tasks?.map((task: any) => ({
          id: task.id,
          url: task.url,
          title: task.title,
          status: task.status,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          errorMessage: task.error_message,
          pdfAvailable: !!task.pdf_filename,
          pdfFilename: task.pdf_filename,
          batchId: data.id
        }))
      };
      
      set({ currentBatch: batchTask });
      return batchTask;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取批量任务状态失败' });
      return null;
    }
  },

  // 加载批量任务历史
  loadBatchHistory: async (page = 1, status?: string) => {
    set({ batchLoading: true });
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await fetch(`/api/batch/history?${params}`);
      
      if (!response.ok) {
        throw new Error('获取批量任务历史失败');
      }
      
      const data = await response.json();
      
      const batches: BatchTask[] = data.batches.map((batch: any) => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        totalTasks: batch.total_tasks,
        completedTasks: batch.completed_tasks,
        failedTasks: batch.failed_tasks,
        zipFilename: batch.zip_filename,
        zipPath: batch.zip_path,
        createdAt: batch.created_at,
        completedAt: batch.completed_at
      }));
      
      set({ 
        batchHistory: batches,
        batchPagination: data.pagination,
        batchLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '获取批量任务历史失败',
        batchLoading: false 
      });
    }
  },

  // 删除批量任务
  deleteBatchTask: async (batchId: string) => {
    try {
      const response = await fetch(`/api/batch/${batchId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除批量任务失败');
      }
      
      // 从历史记录中移除
      const { batchHistory } = get();
      set({ batchHistory: batchHistory.filter(batch => batch.id !== batchId) });
      
      // 如果删除的是当前批量任务，清除当前批量任务
      const { currentBatch } = get();
      if (currentBatch?.id === batchId) {
        set({ currentBatch: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除批量任务失败' });
    }
  },

  // 下载批量ZIP文件
  downloadBatchZip: async (batchId: string) => {
    try {
      const response = await fetch(`/api/batch/download/${batchId}`);
      
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `batch_${batchId}.zip`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);;
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '下载失败' });
    }
  },

  // 批量操作方法
  toggleTaskSelection: (taskId: string) => {
    const { selectedTaskIds } = get();
    const isSelected = selectedTaskIds.includes(taskId);
    
    if (isSelected) {
      set({ selectedTaskIds: selectedTaskIds.filter(id => id !== taskId) });
    } else {
      set({ selectedTaskIds: [...selectedTaskIds, taskId] });
    }
  },

  selectAllTasks: () => {
    const { taskHistory } = get();
    set({ selectedTaskIds: taskHistory.map(task => task.id) });
  },

  selectAllTasksFromAllPages: async (status?: string) => {
    set({ batchOperationLoading: true });
    
    try {
      const response = await apiClient.getAllTaskIds(status);
      
      if (response.success && response.data) {
        set({ 
          selectedTaskIds: response.data.taskIds,
          batchOperationLoading: false 
        });
      } else {
        throw new Error(response.error || 'Failed to get all task IDs');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to select all tasks',
        batchOperationLoading: false 
      });
    }
  },

  clearTaskSelection: () => {
    set({ selectedTaskIds: [] });
  },

  deleteTasks: async (taskIds: string[]) => {
    set({ batchOperationLoading: true });
    
    try {
      const response = await apiClient.deleteTasks(taskIds);
      
      if (response.success) {
        // 清除选中的任务
        set({ selectedTaskIds: [] });
        
        // 如果删除的任务中包含当前任务，清除当前任务
        const { currentTask } = get();
        if (currentTask && taskIds.includes(currentTask.id)) {
          set({ currentTask: null });
        }
        
        // 重新加载当前页的任务历史以确保数据同步
        const { currentPage, statusFilter } = get();
        await get().loadTaskHistory(currentPage, statusFilter);
        
        set({ batchOperationLoading: false });
      } else {
        throw new Error(response.error || 'Failed to delete tasks');
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Batch delete failed',
        batchOperationLoading: false 
      });
    }
  },

  downloadMultiplePDFs: async (taskIds: string[]) => {
    set({ batchOperationLoading: true });
    
    try {
      // 首先获取任务详细信息，筛选出可下载的任务
      const taskDetailsResponse = await apiClient.getTaskDetails(taskIds);
      
      if (!taskDetailsResponse.success || !taskDetailsResponse.data) {
        throw new Error(taskDetailsResponse.error || 'Failed to get task details');
      }
      
      // 筛选出已完成且有PDF的任务
      const downloadableTaskIds = taskDetailsResponse.data.tasks
        .filter(task => task.status === 'completed' && task.pdfAvailable)
        .map(task => task.id);
      
      if (downloadableTaskIds.length === 0) {
        throw new Error('没有可下载的PDF文件');
      }
      
      const blob = await apiClient.downloadMultiplePDFs(downloadableTaskIds);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_pdfs_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      set({ batchOperationLoading: false });
      
      // 返回实际下载的任务数量
      return { downloadedCount: downloadableTaskIds.length, totalSelected: taskIds.length };
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Batch download failed',
        batchOperationLoading: false 
      });
      throw error;
    }
  },

  // 清除错误
  clearError: () => set({ error: null }),
  
  // 清除当前任务
  clearCurrentTask: () => set({ currentTask: null }),
  
  // 清除当前批量任务
  clearCurrentBatch: () => set({ currentBatch: null })
}));