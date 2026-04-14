# 峰哥解答万物 - 部署指南

## Netlify 部署（推荐，中国大陆可访问）

### 1. 在 Netlify 创建项目

访问：https://app.netlify.com/start

配置如下：
- **Site name**: fengge-chatbot（可自定义）
- **Root directory**: （留空）
- **Build command**: （留空）
- **Publish directory**: public

### 2. 设置环境变量

在 Netlify 后台：
1. 进入项目 → Site settings → Environment variables
2. 添加环境变量：
   - Key: `DEEPSEEK_API_KEY`
   - Value: `sk-78750100cd7b446ba1b9930bf338e60c`

### 3. 部署

Netlify 会自动从 GitHub 拉取代码并部署，完成后会给你一个域名（如 `https://fengge-chatbot.netlify.app`）。

---

## 项目结构

```
fengge-chatbot/
├── public/              # 静态文件（Netlify 发布目录）
│   └── index.html       # 前端页面
├── netlify/
│   └── functions/
│       └── api.js       # Netlify Function（API 后端）
├── netlify.toml         # Netlify 配置
├── server.js            # Express 服务器（本地开发用）
├── skill-loader.js      # Skill 加载器
├── fengge-roleplay/     # 峰哥角色扮演
│   ├── SKILL.md
│   └── knowledge_base/
├── package.json
└── .env                 # 本地环境变量（不要上传到 Git）
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 访问 http://localhost:3000
```

---

## API 端点

- `/api/chat` - 非流式聊天
- `/api/chat/stream` - 流式聊天（带思考过程）

Netlify 部署后：
- `/.netlify/functions/api` - 非流式
- `/.netlify/functions/api/stream` - 流式