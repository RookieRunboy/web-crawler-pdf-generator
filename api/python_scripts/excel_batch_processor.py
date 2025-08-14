#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel批量爬取处理器
用于读取Excel文件，提取URL并调用爬虫服务进行批量处理
"""

import pandas as pd
import os
import sys
import json
import zipfile
import requests
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import logging
from urllib.parse import urlparse
import re

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('excel_processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ExcelBatchProcessor:
    """Excel批量处理器"""
    
    def __init__(self, api_base_url: str = "http://localhost:3001"):
        self.api_base_url = api_base_url.rstrip('/')  # 移除末尾斜杠
        self.session = requests.Session()
        self.session.timeout = 300  # 5分钟超时
        
        # 设置连接池和重试策略
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # 测试API连接
        self._test_api_connection()
    
    def _test_api_connection(self):
        """测试API连接"""
        try:
            response = self.session.get(f"{self.api_base_url}/api/health", timeout=10)
            if response.status_code == 200:
                logger.info(f"API连接测试成功: {self.api_base_url}")
            else:
                logger.warning(f"API连接测试失败 (HTTP {response.status_code}): {self.api_base_url}")
        except Exception as e:
            logger.warning(f"API连接测试异常: {str(e)}")
        
    def clean_filename(self, filename: str) -> str:
        """清理文件名，移除不安全字符"""
        if not filename:
            return "untitled"
        
        # 移除控制字符和不安全字符
        cleaned = re.sub(r'[\x00-\x1f\x7f-\xff]', '', filename)
        cleaned = re.sub(r'["\\/:*?<>|\r\n\t\v\f]', '_', cleaned)
        
        # 确保文件名不为空且长度合理
        if not cleaned or len(cleaned.strip()) == 0:
            return "untitled"
        
        return cleaned.strip()[:100]  # 限制长度
    
    def read_excel_file(self, excel_path: str) -> pd.DataFrame:
        """读取Excel文件"""
        try:
            logger.info(f"正在读取Excel文件: {excel_path}")
            
            # 尝试读取Excel文件
            df = pd.read_excel(excel_path)
            
            # 检查必需的列
            if '标题链接' not in df.columns:
                raise ValueError("Excel文件中未找到'标题链接'列")
            
            # 检查标题列是否存在（可选）
            has_title = '标题' in df.columns
            if has_title:
                logger.info("发现标题列，将用作文件名")
            else:
                logger.info("未发现标题列，将使用URL作为文件名")
            
            logger.info(f"成功读取Excel文件，共{len(df)}行数据")
            return df
            
        except Exception as e:
            logger.error(f"读取Excel文件失败: {str(e)}")
            raise
    
    def validate_url(self, url: str) -> bool:
        """验证URL格式"""
        if not url or pd.isna(url):
            return False
        
        try:
            result = urlparse(str(url))
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def create_crawl_task(self, url: str, title: str) -> Optional[str]:
        """创建爬取任务"""
        try:
            payload = {
                "url": url,
                "title": title,
                "options": {
                    "includeImages": True,
                    "timeout": 30
                }
            }
            
            response = self.session.post(
                f"{self.api_base_url}/api/tasks/create",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    task_id = result.get('data', {}).get('taskId')
                    logger.info(f"创建爬取任务成功: {task_id} - {title}")
                    return task_id
            
            logger.error(f"创建爬取任务失败: {response.text}")
            return None
            
        except Exception as e:
            logger.error(f"创建爬取任务异常: {str(e)}")
            return None
    
    def wait_for_task_completion(self, task_id: str, max_wait_time: int = 300) -> bool:
        """等待任务完成"""
        start_time = time.time()
        retry_count = 0
        max_retries = 3
        
        while time.time() - start_time < max_wait_time:
            try:
                # 添加重试机制
                response = self.session.get(
                    f"{self.api_base_url}/api/tasks/status/{task_id}",
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        task_data = result.get('data', {})
                        status = task_data.get('status')
                        
                        if status == 'completed':
                            logger.info(f"任务 {task_id} 完成")
                            return True
                        elif status == 'failed':
                            error_msg = task_data.get('errorMessage', '未知错误')
                            logger.error(f"任务 {task_id} 失败: {error_msg}")
                            return False
                        elif status in ['pending', 'processing']:
                            logger.info(f"任务 {task_id} 状态: {status}")
                            time.sleep(10)  # 增加等待时间
                            retry_count = 0  # 重置重试计数
                            continue
                elif response.status_code == 404:
                    logger.error(f"任务 {task_id} 不存在")
                    return False
                else:
                    logger.warning(f"获取任务状态失败 (HTTP {response.status_code}): {response.text}")
                
            except requests.exceptions.Timeout:
                logger.warning(f"请求超时，重试中... ({retry_count + 1}/{max_retries})")
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"任务 {task_id} 请求超时次数过多")
                    return False
            except requests.exceptions.ConnectionError:
                logger.warning(f"连接错误，重试中... ({retry_count + 1}/{max_retries})")
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"任务 {task_id} 连接失败")
                    return False
            except Exception as e:
                logger.error(f"检查任务状态异常: {str(e)}")
                retry_count += 1
                if retry_count >= max_retries:
                    return False
            
            time.sleep(min(5 * (retry_count + 1), 30))  # 指数退避
        
        logger.error(f"任务 {task_id} 超时")
        return False
    
    def download_pdf(self, task_id: str, output_path: str) -> bool:
        """下载PDF文件"""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                response = self.session.get(
                    f"{self.api_base_url}/api/tasks/download/{task_id}",
                    timeout=60,
                    stream=True
                )
                
                if response.status_code == 200:
                    # 流式下载大文件
                    with open(output_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    
                    # 验证文件是否下载完整
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"PDF下载成功: {output_path}")
                        return True
                    else:
                        logger.error(f"PDF文件下载不完整: {output_path}")
                        if os.path.exists(output_path):
                            os.remove(output_path)
                        
                elif response.status_code == 404:
                    logger.error(f"PDF文件不存在 (任务ID: {task_id})")
                    return False
                else:
                    logger.error(f"PDF下载失败 (HTTP {response.status_code}): {response.text}")
                    
            except requests.exceptions.Timeout:
                logger.warning(f"PDF下载超时，重试中... ({retry_count + 1}/{max_retries})")
            except requests.exceptions.ConnectionError:
                logger.warning(f"PDF下载连接错误，重试中... ({retry_count + 1}/{max_retries})")
            except Exception as e:
                logger.error(f"PDF下载异常: {str(e)}")
                
            retry_count += 1
            if retry_count < max_retries:
                time.sleep(5 * retry_count)  # 指数退避
        
        logger.error(f"PDF下载失败，已重试{max_retries}次")
        return False
    
    def create_zip_file(self, pdf_files: List[str], zip_path: str) -> bool:
        """创建ZIP压缩文件"""
        try:
            logger.info(f"正在创建ZIP文件: {zip_path}")
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for pdf_file in pdf_files:
                    if os.path.exists(pdf_file):
                        # 使用文件名作为ZIP内的路径
                        arcname = os.path.basename(pdf_file)
                        zipf.write(pdf_file, arcname)
                        logger.info(f"添加文件到ZIP: {arcname}")
            
            logger.info(f"ZIP文件创建成功: {zip_path}")
            return True
            
        except Exception as e:
            logger.error(f"创建ZIP文件失败: {str(e)}")
            return False
    
    def process_excel_file(self, excel_path: str, output_dir: str) -> Dict:
        """处理Excel文件的主要方法"""
        result = {
            'success': False,
            'total_tasks': 0,
            'completed_tasks': 0,
            'failed_tasks': 0,
            'zip_path': None,
            'errors': []
        }
        
        try:
            # 读取Excel文件
            df = self.read_excel_file(excel_path)
            
            # 过滤有效的URL
            valid_rows = []
            for index, row in df.iterrows():
                url = str(row['标题链接']).strip()
                
                # 使用标题作为文件名，如果不存在则使用URL
                if '标题' in df.columns and pd.notna(row['标题']):
                    filename = str(row['标题']).strip()
                else:
                    filename = url
                
                if self.validate_url(url):
                    valid_rows.append({
                        'index': index,
                        'url': url,
                        'filename': filename
                    })
                else:
                    logger.warning(f"跳过无效URL (行 {index + 1}): {url}")
            
            result['total_tasks'] = len(valid_rows)
            
            if not valid_rows:
                result['errors'].append("没有找到有效的URL")
                return result
            
            # 确保输出目录存在
            os.makedirs(output_dir, exist_ok=True)
            
            # 处理每个URL
            pdf_files = []
            
            for i, row_data in enumerate(valid_rows):
                logger.info(f"处理进度: {i + 1}/{len(valid_rows)}")
                
                url = row_data['url']
                filename = row_data['filename']
                
                # 创建爬取任务
                task_id = self.create_crawl_task(url, filename)
                if not task_id:
                    result['failed_tasks'] += 1
                    result['errors'].append(f"创建任务失败: {filename}")
                    continue
                
                # 等待任务完成
                if not self.wait_for_task_completion(task_id):
                    result['failed_tasks'] += 1
                    result['errors'].append(f"任务超时或失败: {filename}")
                    continue
                
                # 下载PDF
                clean_filename = self.clean_filename(filename)
                pdf_filename = f"{clean_filename}.pdf"
                pdf_path = os.path.join(output_dir, pdf_filename)
                
                if self.download_pdf(task_id, pdf_path):
                    pdf_files.append(pdf_path)
                    result['completed_tasks'] += 1
                    logger.info(f"任务完成: {filename}")
                else:
                    result['failed_tasks'] += 1
                    result['errors'].append(f"PDF下载失败: {filename}")
            
            # 创建ZIP文件
            if pdf_files:
                excel_name = Path(excel_path).stem
                zip_filename = f"{excel_name}.zip"
                zip_path = os.path.join(output_dir, zip_filename)
                
                if self.create_zip_file(pdf_files, zip_path):
                    result['zip_path'] = zip_path
                    result['success'] = True
                    
                    # 清理临时PDF文件
                    for pdf_file in pdf_files:
                        try:
                            os.remove(pdf_file)
                        except:
                            pass
                else:
                    result['errors'].append("ZIP文件创建失败")
            
            logger.info(f"处理完成: 总计{result['total_tasks']}, 成功{result['completed_tasks']}, 失败{result['failed_tasks']}")
            
        except Exception as e:
            logger.error(f"处理Excel文件异常: {str(e)}")
            result['errors'].append(str(e))
        
        return result

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("用法: python excel_batch_processor.py <excel_file_path> <output_dir> [api_base_url]")
        sys.exit(1)
    
    excel_path = sys.argv[1]
    output_dir = sys.argv[2]
    api_base_url = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:3001/api"
    
    if not os.path.exists(excel_path):
        print(f"错误: Excel文件不存在: {excel_path}")
        sys.exit(1)
    
    processor = ExcelBatchProcessor(api_base_url)
    result = processor.process_excel_file(excel_path, output_dir)
    
    # 输出结果
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    if result['success']:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()