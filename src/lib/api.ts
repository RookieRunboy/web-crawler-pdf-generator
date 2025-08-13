const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export interface CrawlSettings {
  includeImages?: boolean;
  maxPages?: number;
  timeout?: number;
  waitForSelector?: string;
  userAgent?: string;
}

export interface PDFSettings {
  format?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  includeImages?: boolean;
  includeLinks?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface CreateTaskRequest {
  url: string;
  title?: string;
  settings?: {
    crawl?: CrawlSettings;
    pdf?: PDFSettings;
  };
}

export interface TaskResponse {
  success: boolean;
  data?: {
    taskId: string;
    status: string;
    message?: string;
    url?: string;
    title?: string;
    createdAt?: string;
    updatedAt?: string;
    errorMessage?: string;
    pdfAvailable?: boolean;
    pdfFilename?: string;
    contentPreview?: string;
  };
  error?: string;
}

export interface TaskHistoryResponse {
  success: boolean;
  data?: {
    tasks: Array<{
      id: string;
      url: string;
      title?: string;
      status: string;
      created_at: string;
      updated_at: string;
      error_message?: string;
      pdf_filename?: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface TaskIdsResponse {
  success: boolean;
  data?: {
    taskIds: string[];
    total: number;
  };
  error?: string;
}

export interface TaskDetailsResponse {
  success: boolean;
  data?: {
    tasks: Array<{
      id: string;
      url: string;
      title?: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      errorMessage?: string;
      pdfAvailable: boolean;
      pdfFilename?: string;
    }>;
    total: number;
  };
  error?: string;
}

export interface SettingsResponse {
  success: boolean;
  data?: {
    crawl_settings?: CrawlSettings;
    pdf_settings?: PDFSettings;
    general_settings?: {
      autoDownload?: boolean;
      deleteAfterDownload?: boolean;
      maxHistoryItems?: number;
    };
  };
  error?: string;
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // 任务相关API
  async createTask(data: CreateTaskRequest): Promise<TaskResponse> {
    return this.request<TaskResponse>('/tasks/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTaskStatus(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/tasks/status/${taskId}`);
  }

  async downloadPDF(taskId: string): Promise<Blob> {
    const url = `${API_BASE_URL}/tasks/download/${taskId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Download failed');
    }
    
    return response.blob();
  }

  async getTaskHistory(page = 1, limit = 20, status?: string): Promise<TaskHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }
    
    return this.request<TaskHistoryResponse>(`/tasks/history?${params}`);
  }

  async deleteTask(taskId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async deleteTasks(taskIds: string[]): Promise<{ success: boolean; message?: string; error?: string; deletedCount?: number }> {
    return this.request('/tasks/batch', {
      method: 'DELETE',
      body: JSON.stringify({ taskIds }),
    });
  }

  async downloadMultiplePDFs(taskIds: string[]): Promise<Blob> {
    const url = `${API_BASE_URL}/tasks/download/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskIds }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Batch download failed');
    }
    
    return response.blob();
  }

  async getAllTaskIds(status?: string): Promise<TaskIdsResponse> {
    const params = new URLSearchParams();
    
    if (status) {
      params.append('status', status);
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/tasks/all-ids?${queryString}` : '/tasks/all-ids';
    
    return this.request<TaskIdsResponse>(endpoint);
  }

  async getTaskDetails(taskIds: string[]): Promise<TaskDetailsResponse> {
    return this.request<TaskDetailsResponse>('/tasks/details', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  }

  // 设置相关API
  async getSettings(): Promise<SettingsResponse> {
    return this.request<SettingsResponse>('/settings');
  }

  async updateSettings(settings: {
    crawl_settings?: CrawlSettings;
    pdf_settings?: PDFSettings;
    general_settings?: {
      autoDownload?: boolean;
      deleteAfterDownload?: boolean;
      maxHistoryItems?: number;
    };
  }): Promise<SettingsResponse> {
    return this.request<SettingsResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async resetSettings(): Promise<SettingsResponse> {
    return this.request<SettingsResponse>('/settings/reset', {
      method: 'POST',
    });
  }

  // 健康检查
  async healthCheck(): Promise<{ success: boolean; message: string; timestamp: string; version: string }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();