# Web Crawler PDF Generator

一个功能强大的网页爬虫PDF生成器，支持将网页内容转换为PDF文件。

## 功能特性

- 🕷️ **智能网页爬虫**: 使用Puppeteer进行高质量网页内容抓取
- 📄 **PDF生成**: 将爬取的网页内容转换为PDF文件
- 🎨 **现代化界面**: 基于React + TypeScript + Tailwind CSS构建
- 📊 **实时进度**: 实时显示爬取和转换进度
- 📚 **历史记录**: 保存和管理历史任务
- ⚙️ **灵活配置**: 支持多种爬取和PDF生成选项
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
- Puppeteer (网页爬虫)
- Supabase (数据库)

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- Supabase账户

### 安装依赖

```bash
npm install
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

## 使用说明

1. **输入URL**: 在主页面输入要爬取的网页URL
2. **配置选项**: 设置爬取深度、PDF格式等选项
3. **开始爬取**: 点击开始按钮启动爬取任务
4. **查看进度**: 实时查看爬取和转换进度
5. **下载PDF**: 任务完成后下载生成的PDF文件
6. **历史记录**: 在设置页面查看历史任务

## API接口

### 创建任务
```http
POST /api/tasks/create
Content-Type: application/json

{
  "url": "https://example.com",
  "title": "Example Page",
  "settings": {
    "maxDepth": 2,
    "format": "A4"
  }
}
```

### 查询任务状态
```http
GET /api/tasks/:id/status
```

### 下载PDF
```http
GET /api/tasks/:id/download
```

### 获取历史记录
```http
GET /api/tasks/history
```

## 项目结构

```
├── api/                 # 后端API
│   ├── routes/         # 路由定义
│   ├── services/       # 业务逻辑
│   └── config/         # 配置文件
├── src/                # 前端源码
│   ├── components/     # React组件
│   ├── pages/          # 页面组件
│   ├── lib/            # 工具库
│   └── store/          # 状态管理
├── supabase/           # 数据库迁移
└── public/             # 静态资源
```

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License
