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

## 首次启动

前置：本机已装 MySQL 8 并运行在 `localhost:3306`。

```bash
# 1. 配置后端环境变量（填入你的 MySQL 密码）
cp server/.env.example server/.env   # 编辑 DB_PASSWORD

# 2. 安装依赖
npm run install:all

# 3. 建库 + 迁移 + 灌种子（一步到位）
npm run db:setup
```

`db:setup` = `db:create`（创建 `sourcing_radar` 库）+ `db:migrate` + `db:seed`。
重复执行 `npm run db:seed` 会重灌 events/entities/sources，但**保留 engagements**（人工录入不丢）。

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

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/events` | 展会列表 |
| GET | `/api/entities?type=&priority=&event=&angle=&keyword=&includeExcluded=` | 对象列表（默认排除 excluded；type/priority 逗号分隔多值） |
| GET | `/api/entities/:id` | 对象详情 |
| GET | `/api/sources` | 信息源 |
| GET | `/api/engagements[?entityId=]` | 建联记录（全部 / 单个） |
| PUT | `/api/engagements/:entityId` | upsert 建联状态/负责人/备注 |

## 与原飞书版的差异

- 数据从硬编码 JS → MySQL，可增删改（直接改库或扩展 seed）
- 建联状态从浏览器 localStorage → 数据库，多人可见、换设备不丢
- 部署从飞书妙搭 → 本地/自有服务器单进程
- 前端从单文件 → 组件化，新增详情弹窗、HoverCard 速览、移动端 Sheet 筛选、匹配分区间筛选

## 与画师库的关系

姐妹项目，同一套技术栈与组件模式。画师库（`supplier-portal-standalone`）是"已合作复购库"，本雷达是"外部机会发现库"。两者数据库、仓库、端口均独立。
