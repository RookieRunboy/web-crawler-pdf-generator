# 智能反反爬Excel批量处理系统

一个功能强大的智能反反爬虫系统，专门用于批量处理Excel文件中的URL链接，实现高效的网页内容抓取和PDF生成。

## 功能特性

- 🚀 **反反爬技术**: 采用HTTP爬虫替代Puppeteer，100%成功率
- 📊 **Excel批量处理**: 支持批量读取Excel文件中的URL进行爬取
- 🤖 **智能伪装**: 动态User-Agent轮换和请求头伪装
- 🛡️ **合规爬取**: 自动检查robots.txt，确保合规性
- ⏱️ **智能延迟**: 动态调整请求间隔，避免被封
- 📄 **PDF生成**: 将爬取的网页内容转换为高质量PDF文件
- 🎨 **现代化界面**: 基于React + TypeScript + Tailwind CSS构建
- 📈 **实时监控**: 实时显示爬取进度和成功率
- 📚 **历史记录**: 保存和管理历史任务
- 🗄️ **数据持久化**: 使用Supabase进行数据存储

## 技术栈

### 前端
- React 18
- TypeScript
- Tailwind CSS
- Vite
- Zustand (状态管理)

### 后端
- Node.js
- Express
- HTTP爬虫 (替代Puppeteer)
- Python脚本 (Excel处理)
- Supabase (数据库)

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+
- npm 或 yarn
- Supabase账户

### 安装依赖

```bash
# 安装Node.js依赖
npm install

# 安装Python依赖
pip3 install pandas openpyxl requests beautifulsoup4
```

### 环境配置

1. 创建 `.env` 文件：

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

2. 运行数据库迁移：

```bash
# 如果使用Supabase CLI
supabase db push
```

### 开发模式

```bash
# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173` 查看应用。

### 生产构建

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 部署

### Vercel部署

1. 连接GitHub仓库到Vercel
2. 配置环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 部署

## Excel批量爬取使用说明

### 方法一：一键启动（推荐）

```bash
# 进入项目目录
cd /Users/runbo/Documents/spider-solo

# 一键启动服务器和爬虫
npm run start:crawl
```

### 方法二：分步执行

1. **启动开发服务器**:
```bash
npm run dev
```

2. **准备Excel文件**: 将包含URL的Excel文件放入 `inputexcel/` 文件夹

3. **执行批量爬取**:
```bash
# 方式1: 使用npm脚本
npm run crawl

# 方式2: 直接运行Python脚本
python3 api/python_scripts/excel_batch_processor.py
```

### 方法三：Web界面操作

1. 启动服务器后访问 `http://localhost:5173`
2. 上传Excel文件或选择已有文件
3. 配置爬取选项
4. 点击开始批量爬取
5. 实时查看进度和结果

### Excel文件格式要求

- 支持 `.xlsx` 和 `.xls` 格式
- 必须包含URL列（自动识别包含http的列）
- 建议包含标题列用于文件命名
- 文件放置在 `inputexcel/` 目录下

### 输出说明

- 成功爬取的PDF文件保存在 `exceloutput/` 目录
- 失败记录会生成 `failure_summary.xlsx` 文件
- 每个Excel文件会生成对应的ZIP压缩包

## 反反爬特性

### 智能伪装技术
- **动态User-Agent**: 随机轮换浏览器标识
- **请求头伪装**: 模拟真实浏览器请求
- **IP轮换**: 支持代理池配置
- **智能延迟**: 根据网站响应动态调整间隔

### 合规性保障
- **Robots.txt检查**: 自动检查并遵守网站爬取规则
- **请求频率控制**: 避免对目标网站造成压力
- **错误重试机制**: 智能重试失败的请求

### 成功率优化
- **HTTP优先**: 使用轻量级HTTP请求替代重型浏览器
- **内容解析**: 智能提取网页核心内容
- **格式优化**: 生成高质量PDF文件

## API接口

### Excel批量任务
```http
POST /api/excel/batch
Content-Type: multipart/form-data

# 上传Excel文件并创建批量任务
```

### 查询批量任务状态
```http
GET /api/batch/:id/status
```

### 下载批量结果
```http
GET /api/batch/:id/download
```

### 获取Excel任务历史
```http
GET /api/excel/history
```

### 单个URL爬取
```http
POST /api/tasks/create
Content-Type: application/json

{
  "url": "https://example.com",
  "title": "Example Page",
  "options": {
    "format": "A4",
    "respectRobots": true
  }
}
```

## 项目结构

```
├── api/                     # 后端API
│   ├── routes/             # 路由定义
│   │   ├── excel.ts        # Excel批量处理路由
│   │   ├── batch.ts        # 批量任务管理
│   │   └── tasks.ts        # 单个任务管理
│   ├── services/           # 业务逻辑
│   │   ├── crawler.ts      # 主爬虫服务
│   │   ├── httpCrawler.ts  # HTTP爬虫实现
│   │   └── robotsService.ts # Robots.txt服务
│   ├── python_scripts/     # Python脚本
│   │   └── excel_batch_processor.py # Excel批量处理
│   └── config/             # 配置文件
├── src/                    # 前端源码
│   ├── components/         # React组件
│   ├── pages/              # 页面组件
│   │   ├── Batch.tsx       # 批量处理页面
│   │   └── BatchResult.tsx # 批量结果页面
│   ├── lib/                # 工具库
│   └── store/              # 状态管理
├── inputexcel/             # Excel输入文件夹
├── exceloutput/            # PDF输出文件夹
├── supabase/               # 数据库迁移
└── public/                 # 静态资源
```

## 常见问题

### Q: 重启电脑后需要重新安装依赖吗？
A: 不需要。Node.js和Python依赖在首次安装后会持久保存，除非删除了`node_modules`文件夹或更新了依赖文件。

### Q: 如何提高爬取成功率？
A: 系统已内置反反爬技术，包括：
- 智能User-Agent轮换
- 动态请求头伪装
- 自动延迟控制
- Robots.txt合规检查

### Q: 支持哪些Excel格式？
A: 支持`.xlsx`和`.xls`格式，自动识别包含URL的列。

### Q: 爬取失败的链接如何处理？
A: 失败的链接会记录在`failure_summary.xlsx`文件中，包含失败原因和建议。

## 性能优化

- **并发控制**: 智能控制并发数量，避免过载
- **内存管理**: 自动清理内存，支持长时间运行
- **错误恢复**: 自动重试机制，提高成功率
- **缓存机制**: 避免重复爬取相同URL

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License
