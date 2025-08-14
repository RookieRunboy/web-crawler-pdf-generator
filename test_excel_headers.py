#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Excel表头解析功能
"""

import pandas as pd
import sys
import os

def test_excel_headers(excel_path):
    """测试Excel文件的表头解析"""
    try:
        print(f"正在测试Excel文件: {excel_path}")
        
        # 读取Excel文件
        df = pd.read_excel(excel_path)
        
        print(f"\n文件包含 {len(df)} 行数据")
        print(f"列名: {list(df.columns)}")
        
        # 检查必需的列
        if '标题链接' not in df.columns:
            print("❌ 错误: 未找到'标题链接'列")
            return False
        else:
            print("✅ 找到'标题链接'列")
        
        # 检查标题列
        if '标题' in df.columns:
            print("✅ 找到'标题'列")
            
            # 显示前5行数据
            print("\n前5行数据:")
            for i in range(min(5, len(df))):
                title = df.iloc[i]['标题'] if pd.notna(df.iloc[i]['标题']) else "(空)"
                url = df.iloc[i]['标题链接'] if pd.notna(df.iloc[i]['标题链接']) else "(空)"
                print(f"第{i+1}行 - 标题: {title}")
                print(f"       - 链接: {url}")
                print()
        else:
            print("❌ 未找到'标题'列")
            return False
        
        # 检查旧的uuid列是否还存在
        if 'uuid' in df.columns:
            print("⚠️  警告: 仍然存在'uuid'列，可能需要更新Excel文件")
        else:
            print("✅ 确认不存在'uuid'列")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python test_excel_headers.py <excel_file_path>")
        sys.exit(1)
    
    excel_path = sys.argv[1]
    
    if not os.path.exists(excel_path):
        print(f"错误: Excel文件不存在: {excel_path}")
        sys.exit(1)
    
    success = test_excel_headers(excel_path)
    sys.exit(0 if success else 1)