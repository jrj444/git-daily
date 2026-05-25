# GitDaily（极报）— 团队日报管理系统

基于 Next.js 的全栈日报管理工具，对接自建 GitLab 读取提交记录并自动生成日报。支持多用户、模板管理、提交统计分析、团队概览、AI 润色等功能。

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端框架 | Next.js 14 App Router + TypeScript |
| 样式 | Tailwind CSS + next-themes（深色模式） |
| Markdown 编辑 | @uiw/react-md-editor |
| 数据库 | MySQL + Prisma ORM |
| 认证 | NextAuth.js（Credentials Provider, JWT Session） |
| GitLab 对接 | GitLab REST API v4（服务端代理） |
| AI 润色 | OpenAI 兼容接口（可选） |
| 模板引擎 | Handlebars |
| 状态管理 | Zustand |
| 部署 | Docker 多阶段构建 |

## 功能特性

### 个人功能

- **日报生成**：根据当天 GitLab 提交自动生成日报，支持 Handlebars 模板自定义格式
- **日报编辑**：Markdown 编辑器，支持实时预览、复制、保存
- **AI 润色**：一键调用 LLM 优化日报文案（需配置 LLM 相关环境变量）
- **历史管理**：日历视图浏览历史日报，支持编辑和导出
- **日报导出**：选择日期范围，批量导出为 Markdown 文件
- **提交统计**：按类型（feat/fix/refactor 等）统计提交分布，支持项目明细展开
- **本周概览**：首页自动展示最近 7 天的提交统计摘要
- **模板管理**：创建和管理多个日报模板，支持预览和设为默认

### 团队管理（管理员）

- **日报查看**：按日期查看所有成员的日报提交情况
- **成员统计**：查询任意成员的提交统计（复用个人统计能力）
- **团队总览**：提交热力图 + 类型分布 + 成员排名 + 贡献之星
- **用户管理**：创建用户、重置密码、切换角色
- **项目管理**：管理 GitLab 项目列表，设置别名和分支

### 系统特性

- 深色/浅色模式切换
- 移动端响应式适配
- GitLab Token AES-256-GCM 加密存储
- 所有 GitLab 调用走服务端代理，Token 不暴露到浏览器

## 本地开发

### 前置条件

- Node.js >= 18
- MySQL 5.7+ 或 8.x
- pnpm（本项目使用 pnpm）

### 安装步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL、NEXTAUTH_SECRET、ENCRYPTION_KEY

# 3. 初始化数据库
npx prisma migrate dev

# 4. 创建初始管理员账户
pnpm seed
# 默认账户：admin / admin12345

# 5. 启动开发服务器
pnpm dev
```

打开 http://localhost:3000，使用 `admin` / `admin12345` 登录。登录后请立即在用户管理中修改密码。

### 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动开发服务器（热更新） |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm test` | 运行单元测试 |
| `pnpm seed` | 初始化管理员账户 |
| `npx prisma studio` | 打开 Prisma 数据库可视化工具 |
| `npx prisma migrate dev` | 创建并执行数据库迁移 |

## 首次配置

1. 登录后进入 **设置** 页面
2. 填写 GitLab 地址（如 `https://gitlab.company.com`）和 Personal Access Token（需要 `read_api` + `read_repository` 权限），点击"保存并校验"
3. 进入 **项目管理** 页面，勾选需要追踪的项目，可选设置非默认分支或项目别名
4. （可选）在设置中编辑噪音过滤正则（如 `^Merge|^chore:`），过滤不需要的提交
5. （可选）在模板管理中创建自定义 Handlebars 模板

## 生产部署

### Docker 部署（推荐）

```bash
# 构建并启动
docker compose up -d --build
```

Docker 构建流程：
1. 多阶段构建：`deps` → `builder` → `runner`
2. 基于 Node.js 20 Alpine 镜像，产物仅包含 standalone 输出
3. 启动时自动执行 `prisma migrate deploy` 应用待迁移
4. 暴露端口 3000

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | MySQL 连接串，格式：`mysql://user:pass@host:3306/dbname` |
| `NEXTAUTH_URL` | 是 | 应用对外访问地址，如 `https://report.company.com` |
| `NEXTAUTH_SECRET` | 是 | JWT 签名密钥，生成方式：`openssl rand -base64 32` |
| `ENCRYPTION_KEY` | 是 | AES-256 加密密钥（64 位十六进制），生成方式：`openssl rand -hex 32` |
| `LLM_API_BASE` | 否 | OpenAI 兼容接口地址，用于 AI 润色功能 |
| `LLM_API_KEY` | 否 | LLM API 密钥 |
| `LLM_MODEL` | 否 | 模型名称，默认 `gpt-4o-mini` |
| `ADMIN_USERNAME` | 否 | 初始管理员用户名，默认 `admin`（仅 seed 时使用） |
| `ADMIN_PASSWORD` | 否 | 初始管理员密码，默认 `admin12345`（仅 seed 时使用） |
| `ADMIN_DISPLAY_NAME` | 否 | 初始管理员显示名，默认 `Admin`（仅 seed 时使用） |

## 项目结构

```
git-daily/
├── app/                          # Next.js App Router 页面与 API
│   ├── api/
│   │   ├── admin/                # 管理员接口
│   │   │   ├── stats/team/       # 团队统计聚合
│   │   │   ├── team-reports/     # 团队日报查询 + 范围查询
│   │   │   └── users/            # 用户管理 CRUD
│   │   ├── ai/polish/            # AI 润色
│   │   ├── auth/[...nextauth]/   # NextAuth 认证
│   │   ├── gitlab/               # GitLab 对接（项目、Token 校验）
│   │   ├── me/                   # 当前用户信息
│   │   ├── reports/              # 日报 CRUD + 生成 + 导出
│   │   ├── stats/commits/        # 提交统计（支持管理员查询他人）
│   │   └── templates/            # 模板 CRUD + 预览
│   ├── admin/                    # 管理员页面
│   ├── history/                  # 历史日报页面
│   ├── login/                    # 登录页面
│   ├── projects/                 # 项目管理页面
│   ├── settings/                 # 设置页面
│   ├── stats/                    # 统计页面
│   ├── templates/                # 模板管理页面
│   └── page.tsx                  # 首页（日报编辑 + 本周概览）
├── components/                   # React 组件
│   ├── team/                     # 团队相关子组件
│   ├── history-view.tsx          # 历史日报（日历 + 导出）
│   ├── nav.tsx                   # 导航栏
│   ├── report-editor.tsx         # 日报编辑器
│   ├── stats-content.tsx         # 统计内容（可复用，支持 compact 模式）
│   ├── stats-view.tsx            # 统计页面容器
│   ├── weekly-stats.tsx          # 首页本周概览
│   └── ...                       # 其他组件
├── lib/                          # 工具库
│   ├── auth.ts                   # NextAuth 配置
│   ├── crypto.ts                 # AES-256-GCM 加解密
│   ├── gitlab.ts                 # GitLab REST API 封装
│   ├── prisma.ts                 # Prisma 客户端单例
│   ├── report.ts                 # 日报生成逻辑 + conventional commit 解析
│   ├── session.ts                # 会话工具（requireUser, requireAdmin）
│   ├── stats.ts                  # 统计计算（computeUserStats）
│   └── utils.ts                  # 通用工具（cn, utcDate）
├── prisma/
│   ├── schema.prisma             # 数据模型定义
│   ├── seed.ts                   # 初始数据种子
│   └── migrations/               # 数据库迁移记录
├── Dockerfile                    # 多阶段 Docker 构建
├── docker-compose.yml            # Docker Compose 编排
└── package.json                  # 项目配置
```

## 数据模型

| 模型 | 说明 |
|------|------|
| **User** | 用户：账号、角色（MEMBER/ADMIN）、GitLab 配置（加密存储 Token） |
| **Project** | GitLab 项目：关联用户、可设别名和自定义分支、启用/禁用 |
| **Report** | 日报：按日期唯一（每人每天一篇）、Markdown 内容、原始提交 JSON |
| **Template** | 模板：Handlebars 模板、可设为默认 |

## API 接口

| 方法 | 路径 | 用途 | 权限 |
|------|------|------|------|
| POST | `/api/auth/[...nextauth]` | 登录认证 | 公开 |
| GET / PATCH | `/api/me` | 获取/更新当前用户信息 | 登录 |
| POST | `/api/gitlab/validate-token` | 保存 GitLab 配置并校验 | 登录 |
| GET / PATCH | `/api/gitlab/projects` | 获取/更新项目列表 | 登录 |
| GET | `/api/reports/generate?date=YYYY-MM-DD` | 实时生成日报 | 登录 |
| GET / POST / DELETE | `/api/reports` | 日报 CRUD | 登录 |
| GET | `/api/reports/export?startDate&endDate` | 批量导出日报 | 登录 |
| GET | `/api/stats/commits?startDate&endDate` | 提交统计（支持 `userId` 参数） | 登录/管理员 |
| GET / POST / PATCH / DELETE | `/api/templates` | 模板 CRUD | 登录 |
| GET | `/api/templates/preview` | 模板预览 | 登录 |
| POST | `/api/ai/polish` | AI 润色 | 登录 |
| GET / POST / PATCH / DELETE | `/api/admin/users` | 用户管理 | 管理员 |
| GET | `/api/admin/team-reports?date=YYYY-MM-DD` | 团队日报查询 | 管理员 |
| GET | `/api/admin/team-reports/range?startDate&endDate` | 日报提交热力图 | 管理员 |
| GET | `/api/admin/stats/team?startDate&endDate` | 团队统计聚合 | 管理员 |

## 安全说明

- GitLab Personal Access Token 使用 AES-256-GCM 加密后存入数据库，浏览器端仅可见脱敏预览
- 所有 GitLab API 调用走 Next.js 服务端路由，Token 不会发送到客户端
- 用户密码以 bcrypt 哈希存储
- `ENCRYPTION_KEY` 轮换前需先对已有 Token 重新加密，否则用户需重新输入 PAT
