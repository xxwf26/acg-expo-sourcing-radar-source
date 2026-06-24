# ACG展会采购寻源雷达（独立版）

面向营销采购窗口的游戏 / ACG / 美术展会寻源雷达。**已脱离飞书妙搭，重写为独立前后端 + 本地数据库系统。**

汇总展会、艺术家/行业大佬、画师/KOL、周边/展陈/线下活动供应商，并按采购价值（匹配分、优先级 S/A/B）做多维筛选；建联状态/负责人/备注持久化到数据库，支持多人协作。

## 技术栈

- **后端**：NestJS 10 + Drizzle ORM + MySQL 8
- **前端**：React 19 + TypeScript + Vite + Tailwind 4 + shadcn/ui + react-query
- **端口**：后端 `3002`，前端 dev `5175`（避开姐妹项目画师库的 3001/5174）

## 目录结构

```
acg-sourcing-radar-standalone/
├─ server/                 # NestJS 后端
│  ├─ src/
│  │  ├─ database/         # schema.ts(4表) / database.module.ts / seed.ts
│  │  └─ modules/          # event / entity / source / engagement / view
│  ├─ scripts/create-db.mjs   # 无 mysql CLI 环境下创建数据库
│  └─ drizzle/             # drizzle-kit 迁移
├─ client/                 # React 前端
│  └─ src/
│     ├─ api/              # axios 单例 + 各资源 API 对象 + 类型
│     ├─ hooks/            # react-query 数据 hooks
│     ├─ lib/              # filterConfig / badgeStyles / utils
│     └─ pages/RadarDashboardPage/   # 容器 + 5 视图 + 筛选 + 详情弹窗
├─ database/radar-db.json  # 种子数据（源自原飞书导出）
└─ package.json            # 根聚合脚本
```

## 数据模型

| 表 | 说明 | 种子量 |
|---|---|---:|
| `events` | 展会主表 | 10 |
| `entities` | 建联对象（`excluded` 字段取代原 excludedEntityIds） | 36（18 excluded） |
| `sources` | 信息源监控 | 4 |
| `engagements` | 建联状态（取代原 localStorage，每对象一条，按 entityId upsert） | 动态 |
| `users` | 系统用户（登录鉴权，密码 bcrypt 加密） | 2（admin/viewer） |

## 登录与权限

- 全站需登录后访问。未登录访问任何接口返回 401，前端自动跳登录页。
- 两种角色：
  - **admin**：可浏览 + 维护建联状态（状态/负责人/备注）。
  - **viewer**：仅浏览，建联维护区只读。
- 默认账号（首次 `db:seed-users` 生成，**请尽快改密码**）：
  - 管理员：`admin` / `admin123`
  - 只读：`viewer` / `viewer123`
- `JWT_SECRET` 必填于 `server/.env`（`.env.example` 有生成命令）。token 默认 8 小时，勾"记住我"延长到 30 天。
- **改密码**：任何登录用户点左下「改密码」自助修改（校验原密码，改后需重新登录）。
- **账号管理**（仅 admin）：左下「账号管理」可新增用户、改角色/显示名、重置任意用户密码、删除用户。安全护栏：不能删除自己、不能删除或降级最后一个管理员、用户名不可重复、密码至少 6 位。

## 首次启动

前置：本机已装 MySQL 8 并运行在 `localhost:3306`。

```bash
# 1. 配置后端环境变量（填入 MySQL 密码 + 生成 JWT_SECRET）
cp server/.env.example server/.env   # 编辑 DB_PASSWORD 和 JWT_SECRET

# 2. 安装依赖
npm run install:all

# 3. 建库 + 迁移 + 灌种子 + 初始化用户
npm run db:setup
npm run db:seed-users   # 创建 admin / viewer 默认账号
```

`db:setup` = `db:create`（创建 `sourcing_radar` 库）+ `db:migrate` + `db:seed`。
重复执行 `npm run db:seed` 会重灌 events/entities/sources，但**保留 engagements**（人工录入不丢）。
`db:seed-users` 对已存在的用户名跳过，不覆盖已改的密码。

## 开发

```bash
# 分别启动（推荐，端口冲突时易排查）
npm run dev:server     # 后端 :3002（tsc -w + node --watch）
npm run dev:client     # 前端 :5175（vite，/api 代理到 3002）

# 或并行启动
npm run dev
```

访问 http://localhost:5175

## 生产（单进程部署）

```bash
npm run build          # 构建前端到 client/dist + 编译后端到 server/dist
npm run start          # 只起后端，NestJS 托管前端静态资源 + SPA fallback
```

访问 http://localhost:3002 （前端、API 同源）

## API

所有 `/api/*`（除登录外）均需 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/api/auth/login` | 登录，返回 JWT | 公开 |
| GET | `/api/auth/me` | 校验 token，返回当前用户 | 登录 |
| PUT | `/api/auth/password` | 自助改密（校验原密码） | 登录 |
| GET | `/api/events` | 展会列表 | 登录 |
| POST/PUT/DELETE | `/api/events[/:id]` | 展会增/改/删（删除前检查是否被对象关联） | **仅 admin** |
| GET | `/api/entities?type=&priority=&event=&angle=&keyword=&includeExcluded=` | 对象列表（默认排除 excluded；type/priority 逗号分隔多值） | 登录 |
| GET | `/api/entities/:id` | 对象详情 | 登录 |
| POST/PUT/DELETE | `/api/entities[/:id]` | 对象增/改/删（新增自动 UUID；删除前检查是否有建联记录） | **仅 admin** |
| GET | `/api/sources` | 信息源 | 登录 |
| POST/PUT/DELETE | `/api/sources[/:id]` | 信息源增/改/删 | **仅 admin** |
| GET | `/api/engagements[?entityId=]` | 建联记录（全部 / 单个） | 登录 |
| PUT | `/api/engagements/:entityId` | upsert 建联状态/负责人/备注（`updatedBy` 取自 token） | **仅 admin** |
| GET | `/api/users` | 用户列表（不含密码） | **仅 admin** |
| POST | `/api/users` | 新增用户 | **仅 admin** |
| PUT | `/api/users/:id` | 改角色/显示名（护栏：不可降级最后一个 admin） | **仅 admin** |
| PUT | `/api/users/:id/password` | 重置指定用户密码 | **仅 admin** |
| DELETE | `/api/users/:id` | 删除用户（护栏：不可删自己/最后一个 admin） | **仅 admin** |

> **增删改（CRUD）**：admin 登录后，建联对象/展会/信息源三类均可在网页上增删改——对象在详情弹窗内"编辑/新增"，展会与信息源用各自的编辑弹窗。标签/案例用 chip 编辑，关联展会/采购视角用多选，链接/视觉预览用行编辑。删除带引用保护：被建联记录引用的对象、被对象关联的展会会被拒绝删除并提示。viewer 只读，看不到任何增删改入口。

## 与原飞书版的差异

- 数据从硬编码 JS → MySQL，可增删改（直接改库或扩展 seed）
- 建联状态从浏览器 localStorage → 数据库，多人可见、换设备不丢
- 部署从飞书妙搭 → 本地/自有服务器单进程
- 前端从单文件 → 组件化，新增详情弹窗、HoverCard 速览、移动端 Sheet 筛选、匹配分区间筛选

## 与画师库的关系

姐妹项目，同一套技术栈与组件模式。画师库（`supplier-portal-standalone`）是"已合作复购库"，本雷达是"外部机会发现库"。两者数据库、仓库、端口均独立。
