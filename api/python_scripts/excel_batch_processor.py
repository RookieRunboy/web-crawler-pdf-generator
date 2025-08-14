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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import threading

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

class FailureReport:
    """失败报告管理器"""
    
    def __init__(self, source_excel_name: str = None):
        self.failures = []
        self.lock = threading.Lock()
        self.source_excel_name = source_excel_name
    
    def add_failure(self, title_link: str, title: str, reason: str, timestamp: str = None, source_excel: str = None):
        """添加失败记录"""
        if timestamp is None:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # 使用传入的源Excel文件名，如果没有则使用初始化时的名称
        excel_source = source_excel or self.source_excel_name or "未知"
        
        with self.lock:
            self.failures.append({
                '标题链接': title_link,
                '标题': title,
                '失败原因': reason,
                '失败时间': timestamp,
                '源Excel文件': excel_source
            })
    
    def generate_report(self, output_path: str) -> bool:
        """生成失败报告Excel文件"""
        try:
            if not self.failures:
                logger.info("没有失败记录，跳过生成失败报告")
                return True
            
            df = pd.DataFrame(self.failures)
            df.to_excel(output_path, index=False, engine='openpyxl')
            logger.info(f"失败报告已生成: {output_path}")
            return True
        except Exception as e:
            logger.error(f"生成失败报告失败: {str(e)}")
            return False
    
    def append_to_global_summary(self, global_summary_path: str) -> bool:
        """将失败记录追加到全局汇总文件"""
        try:
            if not self.failures:
                logger.info("没有失败记录，跳过追加到全局汇总")
                return True
            
            # 检查全局汇总文件是否存在
            if os.path.exists(global_summary_path):
                # 读取现有数据
                try:
                    existing_df = pd.read_excel(global_summary_path, engine='openpyxl')
                    logger.info(f"读取现有全局汇总文件: {len(existing_df)}条记录")
                except Exception as e:
                    logger.warning(f"读取现有全局汇总文件失败，将创建新文件: {str(e)}")
                    existing_df = pd.DataFrame()
            else:
                existing_df = pd.DataFrame()
                logger.info("全局汇总文件不存在，将创建新文件")
            
            # 创建新的失败记录DataFrame
            new_df = pd.DataFrame(self.failures)
            
            # 合并数据
            if not existing_df.empty:
                combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            else:
                combined_df = new_df
            
            # 按时间排序
            combined_df = combined_df.sort_values('失败时间', ascending=False)
            
            # 保存到全局汇总文件
            combined_df.to_excel(global_summary_path, index=False, engine='openpyxl')
            logger.info(f"全局失败汇总已更新: {global_summary_path} (新增{len(self.failures)}条，总计{len(combined_df)}条)")
            return True
            
        except Exception as e:
            logger.error(f"追加到全局汇总失败: {str(e)}")
            return False
    
    def get_failure_count(self) -> int:
        """获取失败数量"""
        return len(self.failures)
    
    def get_failure_summary(self) -> List[str]:
        """获取失败摘要"""
        return [f"{f['标题']}: {f['失败原因']}" for f in self.failures]

class ExcelBatchProcessor:
    """Excel批量处理器"""
    
    def __init__(self, api_base_url: str = "http://localhost:3001", max_workers: int = 15, max_retries: int = 2, source_excel_name: str = None):
        self.api_base_url = api_base_url.rstrip('/')  # 移除末尾斜杠
        self.session = requests.Session()
        self.session.timeout = 300  # 5分钟超时
        self.max_workers = max_workers  # 并发线程数
        self.max_retries = max_retries  # 最大重试次数
        self.failure_report = FailureReport(source_excel_name)  # 失败报告管理器
        
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
    
    def fix_url_format(self, url: str) -> str:
        """修复URL格式问题"""
        if not url or pd.isna(url):
            return url
        
        original_url = str(url).strip()
        if not original_url:
            return original_url
        
        fixed_url = original_url
        
        # 修复常见的URL格式问题
        if original_url.startswith('https:/') and not original_url.startswith('https://'):
            # 处理 https:/ -> https://
            fixed_url = original_url.replace('https:/', 'https://', 1)
            logger.info(f"修复URL: {original_url} -> {fixed_url}")
        elif original_url.startswith('http:/') and not original_url.startswith('http://'):
            # 处理 http:/ -> http://
            fixed_url = original_url.replace('http:/', 'http://', 1)
            logger.info(f"修复URL: {original_url} -> {fixed_url}")
        elif original_url.startswith('https/') and not original_url.startswith('https://'):
            # 处理 https/ -> https://
            fixed_url = original_url.replace('https/', 'https://', 1)
            logger.info(f"修复URL: {original_url} -> {fixed_url}")
        elif original_url.startswith('http/') and not original_url.startswith('http://'):
            # 处理 http/ -> http://
            fixed_url = original_url.replace('http/', 'http://', 1)
            logger.info(f"修复URL: {original_url} -> {fixed_url}")
            
        return fixed_url
    
    def validate_url(self, url: str) -> bool:
        """验证URL格式"""
        if not url or pd.isna(url):
            return False
        
        url = str(url).strip()
        if not url:
            return False
            
        # 检查URL格式
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
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
            
            error_msg = f"HTTP {response.status_code}: {response.text}"
            logger.error(f"创建爬取任务失败: {error_msg}")
            return None
            
        except Exception as e:
            error_msg = f"网络异常: {str(e)}"
            logger.error(f"创建爬取任务异常: {error_msg}")
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
    
    def process_single_url(self, url: str, title: str, output_dir: str) -> Tuple[bool, str, str]:
        """处理单个URL的完整流程
        
        Returns:
            Tuple[bool, str, str]: (成功标志, PDF文件路径或错误信息, 详细错误信息)
        """
        clean_filename = self.clean_filename(title)
        pdf_filename = f"{clean_filename}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)
        
        try:
            # 创建爬取任务
            task_id = self.create_crawl_task(url, title)
            if not task_id:
                error_msg = "创建爬取任务失败"
                self.failure_report.add_failure(url, title, error_msg)
                return False, error_msg, error_msg
            
            # 等待任务完成
            if not self.wait_for_task_completion(task_id):
                error_msg = "任务超时或执行失败"
                self.failure_report.add_failure(url, title, error_msg)
                return False, error_msg, error_msg
            
            # 下载PDF
            if self.download_pdf(task_id, pdf_path):
                logger.info(f"成功处理URL: {title}")
                return True, pdf_path, ""
            else:
                error_msg = "PDF下载失败"
                self.failure_report.add_failure(url, title, error_msg)
                return False, error_msg, error_msg
                
        except Exception as e:
            error_msg = f"处理异常: {str(e)}"
            logger.error(f"处理URL异常: {title} - {error_msg}")
            self.failure_report.add_failure(url, title, error_msg)
            return False, error_msg, error_msg
    
    def create_zip_file(self, pdf_files: List[str], zip_path: str, failure_report_path: str = None) -> bool:
        """创建ZIP压缩文件，包含PDF文件和失败报告"""
        try:
            logger.info(f"正在创建ZIP文件: {zip_path}")
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加PDF文件
                for pdf_file in pdf_files:
                    if os.path.exists(pdf_file):
                        # 使用文件名作为ZIP内的路径
                        arcname = os.path.basename(pdf_file)
                        zipf.write(pdf_file, arcname)
                        logger.info(f"添加PDF文件到ZIP: {arcname}")
                
                # 添加失败报告文件
                if failure_report_path and os.path.exists(failure_report_path):
                    arcname = os.path.basename(failure_report_path)
                    zipf.write(failure_report_path, arcname)
                    logger.info(f"添加失败报告到ZIP: {arcname}")
            
            logger.info(f"ZIP文件创建成功: {zip_path}")
            return True
            
        except Exception as e:
            logger.error(f"创建ZIP文件失败: {str(e)}")
            return False
    
    def process_excel_file(self, excel_path: str) -> Dict:
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
                original_url = str(row['标题链接']).strip()
                
                # 修复URL格式问题
                fixed_url = self.fix_url_format(original_url)
                
                # 使用标题作为文件名，如果不存在则使用URL
                if '标题' in df.columns and pd.notna(row['标题']):
                    filename = str(row['标题']).strip()
                else:
                    filename = fixed_url
                
                # 添加详细的调试信息
                logger.info(f"处理行 {index + 1}: 原始URL='{original_url}', 修复后URL='{fixed_url}'")
                
                # 验证修复后的URL
                is_valid = self.validate_url(fixed_url)
                logger.info(f"URL验证结果 (行 {index + 1}): {is_valid}")
                
                if is_valid:
                    valid_rows.append({
                        'index': index,
                        'url': fixed_url,  # 使用修复后的URL
                        'filename': filename
                    })
                    if fixed_url != original_url:
                        logger.info(f"URL已修复 (行 {index + 1}): {original_url} -> {fixed_url}")
                else:
                    logger.warning(f"跳过无效URL (行 {index + 1}): {original_url}")
                    self.failure_report.add_failure(original_url, filename, "无效的URL格式")
            
            result['total_tasks'] = len(valid_rows)
            
            if not valid_rows:
                result['errors'].append("没有找到有效的URL")
                return result
            
            # 固定输出目录为项目根目录下的exceloutput文件夹
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(os.path.dirname(script_dir))
            output_dir = os.path.join(project_root, 'exceloutput')
            
            # 确保输出目录存在
            os.makedirs(output_dir, exist_ok=True)
            
            # 使用并行处理
            pdf_files = []
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # 提交所有任务
                future_to_data = {
                    executor.submit(self.process_single_url, row_data['url'], row_data['filename'], output_dir): row_data
                    for row_data in valid_rows
                }
                
                # 收集结果
                for i, future in enumerate(as_completed(future_to_data), 1):
                    row_data = future_to_data[future]
                    logger.info(f"处理进度: {i}/{len(valid_rows)}")
                    
                    try:
                        success, pdf_path_or_error, detailed_error = future.result()
                        
                        if success:
                            pdf_files.append(pdf_path_or_error)
                            result['completed_tasks'] += 1
                            logger.info(f"任务完成: {row_data['filename']}")
                        else:
                            result['failed_tasks'] += 1
                            result['errors'].append(f"{row_data['filename']}: {pdf_path_or_error}")
                            
                    except Exception as e:
                        result['failed_tasks'] += 1
                        error_msg = f"并行处理异常: {str(e)}"
                        result['errors'].append(f"{row_data['filename']}: {error_msg}")
                        self.failure_report.add_failure(row_data['url'], row_data['filename'], error_msg)
            
            # 生成失败报告
            failure_report_path = None
            if self.failure_report.failures:
                excel_name = Path(excel_path).stem
                failure_report_filename = f"{excel_name}_failure_report.xlsx"
                failure_report_path = os.path.join(output_dir, failure_report_filename)
                
                if self.failure_report.generate_report(failure_report_path):
                    logger.info(f"失败报告已生成: {failure_report_path}")
                else:
                    logger.error("失败报告生成失败")
                    result['errors'].append("失败报告生成失败")
                
                # 追加到全局失败汇总文件
                global_summary_path = os.path.join(output_dir, "failure_summary.xlsx")
                if self.failure_report.append_to_global_summary(global_summary_path):
                    logger.info(f"已追加到全局失败汇总: {global_summary_path}")
                else:
                    logger.error("追加到全局失败汇总失败")
                    result['errors'].append("追加到全局失败汇总失败")
            
            # 创建ZIP文件
            if pdf_files or failure_report_path:
                excel_name = Path(excel_path).stem
                zip_filename = f"{excel_name}.zip"
                zip_path = os.path.join(output_dir, zip_filename)
                
                if self.create_zip_file(pdf_files, zip_path, failure_report_path):
                    result['zip_path'] = zip_path
                    result['success'] = True
                    
                    # 清理临时文件
                    for pdf_file in pdf_files:
                        try:
                            os.remove(pdf_file)
                        except:
                            pass
                    
                    # 清理失败报告文件
                    if failure_report_path and os.path.exists(failure_report_path):
                        try:
                            os.remove(failure_report_path)
                        except:
                            pass
                else:
                    result['errors'].append("ZIP文件创建失败")
            else:
                result['errors'].append("没有成功的PDF文件或失败报告可打包")
            
            logger.info(f"处理完成: 总计{result['total_tasks']}, 成功{result['completed_tasks']}, 失败{result['failed_tasks']}")
            
        except Exception as e:
            logger.error(f"处理Excel文件异常: {str(e)}")
            result['errors'].append(str(e))
        
        return result

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python excel_batch_processor.py <excel_file_path> [api_base_url]")
        sys.exit(1)
    
    excel_path = sys.argv[1]
    api_base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3001"
    
    if not os.path.exists(excel_path):
        print(f"错误: Excel文件不存在: {excel_path}")
        sys.exit(1)
    
    # 获取Excel文件名（不含扩展名）作为源文件标识
    excel_name = Path(excel_path).stem
    
    processor = ExcelBatchProcessor(api_base_url, source_excel_name=excel_name)
    result = processor.process_excel_file(excel_path)
    
    # 输出结果
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    if result['success']:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()