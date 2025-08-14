#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel批量处理器
用于读取Excel文件中的URL链接，批量创建爬取任务并下载PDF文件
"""

import pandas as pd
import requests
import time
import zipfile
import os
import sys
import logging
from urllib.parse import urlparse
from typing import List, Dict, Optional
import uuid
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('excel_processor.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ExcelBatchProcessor:
    def __init__(self, api_base_url: str = "http://localhost:3001"):
        self.api_base_url = api_base_url.rstrip('/')
        self.session = requests.Session()
        self.session.timeout = 30
        
    def validate_url(self, url: str) -> bool:
        """验证URL格式"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def read_excel_file(self, excel_file_path: str) -> List[str]:
        """读取Excel文件并提取URL链接"""
        try:
            # 尝试读取Excel文件
            df = pd.read_excel(excel_file_path)
            logger.info(f"成功读取Excel文件: {excel_file_path}")
            logger.info(f"文件包含 {len(df)} 行数据")
            logger.info(f"列名: {list(df.columns)}")
            
            # 查找包含链接的列
            url_column = None
            for col in df.columns:
                if '链接' in str(col) or 'url' in str(col).lower() or 'link' in str(col).lower():
                    url_column = col
                    break
            
            if url_column is None:
                # 如果没有找到明确的链接列，尝试第一列
                url_column = df.columns[0]
                logger.warning(f"未找到明确的链接列，使用第一列: {url_column}")
            else:
                logger.info(f"找到链接列: {url_column}")
            
            # 提取URL
            urls = []
            for idx, url in enumerate(df[url_column]):
                if pd.notna(url) and str(url).strip():
                    url_str = str(url).strip()
                    if self.validate_url(url_str):
                        urls.append(url_str)
                    else:
                        logger.warning(f"第{idx+1}行URL格式无效: {url_str}")
            
            logger.info(f"提取到 {len(urls)} 个有效URL")
            return urls
            
        except Exception as e:
            logger.error(f"读取Excel文件失败: {e}")
            raise
    
    def create_crawl_task(self, url: str) -> Optional[str]:
        """创建爬取任务"""
        try:
            payload = {
                "url": url,
                "options": {
                    "waitTime": 3000,
                    "generatePdf": True
                }
            }
            
            response = self.session.post(
                f"{self.api_base_url}/api/tasks/create",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    task_id = data.get('taskId')
                    logger.info(f"成功创建任务: {task_id} for URL: {url}")
                    return task_id
                else:
                    logger.error(f"创建任务失败: {data.get('error', '未知错误')}")
            else:
                logger.error(f"创建任务HTTP错误: {response.status_code}")
                
        except Exception as e:
            logger.error(f"创建任务异常: {e}")
        
        return None
    
    def get_task_status(self, task_id: str) -> Dict:
        """获取任务状态"""
        try:
            response = self.session.get(
                f"{self.api_base_url}/api/tasks/status/{task_id}",
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"获取任务状态失败: HTTP {response.status_code}")
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.warning(f"获取任务状态异常: {e}")
            return {"success": False, "error": str(e)}
    
    def wait_for_task_completion(self, task_id: str, max_wait_time: int = 300) -> bool:
        """等待任务完成"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status_data = self.get_task_status(task_id)
            
            if status_data.get('success'):
                task_status = status_data.get('task', {}).get('status')
                
                if task_status == 'completed':
                    logger.info(f"任务 {task_id} 已完成")
                    return True
                elif task_status == 'failed':
                    logger.error(f"任务 {task_id} 失败")
                    return False
                else:
                    logger.info(f"任务 {task_id} 状态: {task_status}，继续等待...")
            else:
                logger.warning(f"获取任务状态失败: {status_data.get('error', '未知错误')}")
            
            time.sleep(5)
        
        logger.error(f"任务 {task_id} 等待超时")
        return False
    
    def download_pdf(self, task_id: str, output_dir: str) -> Optional[str]:
        """下载PDF文件"""
        try:
            response = self.session.get(
                f"{self.api_base_url}/api/tasks/download/{task_id}",
                timeout=60,
                stream=True
            )
            
            if response.status_code == 200:
                # 从响应头获取文件名
                content_disposition = response.headers.get('content-disposition', '')
                filename = f"{task_id}.pdf"
                
                if 'filename=' in content_disposition:
                    filename = content_disposition.split('filename=')[1].strip('"')
                
                file_path = os.path.join(output_dir, filename)
                
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                logger.info(f"成功下载PDF: {file_path}")
                return file_path
            else:
                logger.error(f"下载PDF失败: HTTP {response.status_code}")
                
        except Exception as e:
            logger.error(f"下载PDF异常: {e}")
        
        return None
    
    def create_zip_file(self, pdf_files: List[str], excel_filename: str, output_dir: str) -> str:
        """创建ZIP文件"""
        # 从Excel文件名生成ZIP文件名
        base_name = os.path.splitext(os.path.basename(excel_filename))[0]
        zip_filename = f"{base_name}.zip"
        zip_path = os.path.join(output_dir, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for pdf_file in pdf_files:
                if os.path.exists(pdf_file):
                    arcname = os.path.basename(pdf_file)
                    zipf.write(pdf_file, arcname)
                    logger.info(f"添加文件到ZIP: {arcname}")
        
        logger.info(f"创建ZIP文件: {zip_path}")
        return zip_path
    
    def process_excel_file(self, excel_file_path: str, output_dir: str) -> Dict:
        """处理Excel文件的主要方法"""
        logger.info(f"开始处理Excel文件: {excel_file_path}")
        
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 读取Excel文件
        urls = self.read_excel_file(excel_file_path)
        
        if not urls:
            logger.error("未找到有效的URL")
            return {"success": False, "error": "未找到有效的URL"}
        
        # 创建任务并处理
        successful_downloads = []
        failed_tasks = []
        
        for i, url in enumerate(urls, 1):
            logger.info(f"处理第 {i}/{len(urls)} 个URL: {url}")
            
            # 创建爬取任务
            task_id = self.create_crawl_task(url)
            if not task_id:
                failed_tasks.append({"url": url, "error": "创建任务失败"})
                continue
            
            # 等待任务完成
            if self.wait_for_task_completion(task_id):
                # 下载PDF
                pdf_path = self.download_pdf(task_id, output_dir)
                if pdf_path:
                    successful_downloads.append(pdf_path)
                else:
                    failed_tasks.append({"url": url, "task_id": task_id, "error": "下载PDF失败"})
            else:
                failed_tasks.append({"url": url, "task_id": task_id, "error": "任务执行失败或超时"})
        
        # 创建ZIP文件
        zip_path = None
        if successful_downloads:
            zip_path = self.create_zip_file(successful_downloads, excel_file_path, output_dir)
        
        # 返回处理结果
        result = {
            "success": True,
            "total_urls": len(urls),
            "successful_downloads": len(successful_downloads),
            "failed_tasks": len(failed_tasks),
            "zip_file": zip_path,
            "pdf_files": successful_downloads,
            "failures": failed_tasks
        }
        
        logger.info(f"处理完成: 成功 {len(successful_downloads)}/{len(urls)}")
        if failed_tasks:
            logger.warning(f"失败的任务: {len(failed_tasks)}")
            for failure in failed_tasks:
                logger.warning(f"  - {failure['url']}: {failure['error']}")
        
        return result

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("使用方法: python excel_batch_processor.py <excel_file_path> <output_dir> [api_base_url]")
        print("示例: python excel_batch_processor.py data.xlsx ./downloads http://localhost:3001")
        sys.exit(1)
    
    excel_file_path = sys.argv[1]
    output_dir = sys.argv[2]
    api_base_url = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:3001"
    
    # 检查Excel文件是否存在
    if not os.path.exists(excel_file_path):
        logger.error(f"Excel文件不存在: {excel_file_path}")
        sys.exit(1)
    
    # 创建处理器并执行
    processor = ExcelBatchProcessor(api_base_url)
    
    try:
        result = processor.process_excel_file(excel_file_path, output_dir)
        
        if result["success"]:
            print(f"\n处理完成!")
            print(f"总URL数: {result['total_urls']}")
            print(f"成功下载: {result['successful_downloads']}")
            print(f"失败任务: {result['failed_tasks']}")
            if result['zip_file']:
                print(f"ZIP文件: {result['zip_file']}")
        else:
            print(f"处理失败: {result['error']}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"程序执行异常: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
