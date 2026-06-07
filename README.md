# 📝 MyNote

> 跨平台 Markdown 笔记应用 — 电脑/手机实时同步，随时随地记录灵感。

---

## 🚀 如何使用

### 打开 & 登录

1. 浏览器打开 **[mynote-app-gules.vercel.app](https://mynote-app-gules.vercel.app)**
2. 点击 **「使用 GitHub 登录」** → 授权后自动进入主界面
3. 手机端：同样打开网址，Chrome 菜单 → **「添加到主屏幕」** 即可安装为 App

> 需要 GitHub 账号。如果没有，去 [github.com](https://github.com) 免费注册一个。

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 📝 **Markdown 编辑** | 所见即所得编辑器，支持实时预览 |
| 💾 **自动保存** | 停止输入 0.8 秒后自动保存到云端 |
| 📁 **文件夹管理** | 新建、删除、嵌套文件夹，点击筛选 |
| 🏷️ **标签系统** | 给笔记打标签，按标签快速筛选 |
| 🔐 **GitHub 登录** | OAuth 安全认证，笔记数据隔离 |
| ☁️ **云端同步** | 电脑写完 → 手机自动看到（Supabase 实时同步） |
| 📱 **PWA 支持** | 手机浏览器打开即可安装到桌面，离线也能查看 |
| 🌙 **暗色主题** | 全应用暗色 UI，保护眼睛 |
| 🗑️ **删除确认** | 文件夹/标签/笔记删除前弹出确认弹窗 |

---

## 🎯 优势

### 🆚 对比传统笔记软件

| | MyNote | 记事本 | 有道云笔记 | Notion |
|--|:--:|:--:|:--:|:--:|
| **免费** | ✅ | ✅ | 部分功能收费 | 部分功能收费 |
| **Markdown** | ✅ | ❌ | ✅ | ✅ |
| **跨平台同步** | ✅ | ❌ | ✅ | ✅ |
| **文件夹+标签** | ✅ | ❌ | ✅ | ✅ |
| **手机 PWA** | ✅ | ❌ | App 安装 | App 安装 |
| **开源可自部署** | ✅ | — | ❌ | ❌ |
| **数据自有** | ✅ | — | ❌ | ❌ |

### 🌟 独特优势

- **零安装**：浏览器即用，无需下载任何软件
- **数据自有**：基于 Supabase，数据存在你自己的数据库中
- **完全免费**：Supabase + Vercel 免费额度足够个人使用
- **开源**：代码完全开放，可自由修改和自部署
- **轻量**：PWA 安装包 < 2MB，不占手机存储

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite |
| Markdown 编辑器 | [@uiw/react-md-editor](https://github.com/uiwjs/react-md-editor) |
| 后端/数据库 | [Supabase](https://supabase.com) (PostgreSQL + Realtime) |
| 认证 | Supabase Auth (GitHub OAuth) |
| PWA | [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) |
| 部署 | [Vercel](https://vercel.com) |
| 路由 | React Router v7 |

---

## 📂 项目结构

```
MyNote/
├── src/
│   ├── components/
│   │   ├── Login.jsx          # GitHub 登录页
│   │   ├── Dashboard.jsx      # 主面板（数据加载+筛选）
│   │   ├── Sidebar.jsx        # 侧边栏（文件夹树+标签+笔记列表）
│   │   └── Editor.jsx         # Markdown 编辑器（自动保存+标签）
│   ├── contexts/
│   │   └── AuthContext.jsx    # 认证状态管理
│   └── lib/
│       └── supabaseClient.js  # Supabase 客户端
├── sql/
│   └── schema.sql             # 数据库建表脚本（含 RLS 策略）
├── public/
│   ├── manifest.json          # PWA 清单
│   ├── icon-192.png           # 应用图标
│   └── icon-512.png           # 应用图标
└── vercel.json                # Vercel 部署配置
```

---

## 🔧 自部署指南

如果你想部署自己的实例：

### 前置条件
- [GitHub](https://github.com) 账号
- [Supabase](https://supabase.com) 账号（免费）
- [Vercel](https://vercel.com) 账号（免费）

### 步骤

**1. 克隆仓库**
```bash
git clone https://github.com/你的用户名/MyNote.git
cd MyNote
npm install
```

**2. 配置 Supabase**
- 在 Supabase 创建新项目
- 进入 SQL Editor → 粘贴 `sql/schema.sql` 全部内容 → Run
- 进入 Settings → API → 复制 `Project URL` 和 `anon key`
- 进入 Authentication → Providers → GitHub → 配置 OAuth

**3. 配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 填入 Supabase 的 URL 和 anon key
```

**4. 部署到 Vercel**
```bash
npx vercel login
npx vercel --prod --yes
```
然后在 Vercel 控制台设置同样的环境变量。

---

## 📄 许可证

MIT License
