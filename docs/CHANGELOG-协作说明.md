# 协作说明 · 2026-07-03 更新

> 给伙伴看：本次我方推送了 5 个 commit 并合并了你的「采集子系统全量优化」。
> 以下是**你 pull 后需要做的事**，以及**本次改动清单**。

---

## ⚠️ 伙伴 pull 后需要做的（否则会报错/功能异常）

1. **装新依赖**（后端加了 helmet）
   ```bash
   cd server && npm install
   ```

2. **跑数据库迁移**（新增迁移 0007，给 entities 表加联系方式字段）
   ```bash
   npm run db:migrate
   ```
   - 迁移 0007 只做 3 条 `ADD COLUMN`（`contacts` / `contact_checked_at` / `contact_checked_by`），纯增量、不动现有数据。
   - **在权威库（你机器上的完整库）跑**。不跑的话，前端「找联系方式」录入会因缺列报错。

3. **抓取按钮不显示时**：说明库里信息源缺抓取配置。二选一：
   - 库是纯 seed / 可重灌 → `npm run db:seed`（**会先清空 entities/events/sources 再重灌**，建联状态 engagements 保留）。重灌后 AX + AnimeJapan 两个源自带抓取配置。
   - 库里已有你的人工数据 → **别跑 seed**，改用 admin 登录界面，给源手动填 url + 选 browser + 开 enabled。

4. **合并可能影响你的地方**（见下方「合并冲突处理」）——你的采集优化我基本整体保留了，但有几处我叠加了安全修复，若发现行为和你预期不同，看那一节。

---

## 本次改动清单（我方 5 个 commit）

### 1. `feat(contact)` 联系方式功能升级
- 「找联系方式」从一次性搜索工具 → 可沉淀的知识库：搜索入口按对象类型/地区分组、修死链、加 Google 精准 dork（找邮箱/找官网）。
- entities 加结构化 `contacts` 字段 + 「最近核实人/时间」，可录入保存、团队共享、CSV 导出带联系方式列。
- **迁移 0007**（见上）。

### 2. `fix` 系统审查修复（安全 + 数据完整性 + 并发）
- **SSRF**：抓取 URL 校验（这块和你的 fetcher 优化重叠，合并时采用了你的版本，见下）。
- **断点续抓漏抓**：块失败时 offset 不再越过失败块（H1）。
- **打分写错对象**：校验 LLM 返回 id 属于本批 + status=pending 兜底（H2）。
- **promote/merge 加事务**：避免崩溃时产生重复正式对象（H3）。
- **每周/手动抓取加 per-source 重入锁**：防同源并发 offset 覆盖 + 去重竞态。
- 前端：建联备注被 refetch 覆盖修复、联系方式连续录入丢数据修复、merge 后刷新对象列表。

### 3. `chore` 冗余清理
- 删「本周建议动作」整条前后端死链（AiWeeklyActionsPanel + hook + api + 后端路由 + service + prompt）。
- 删 5 个未用 UI 组件（card/label/separator/slider/tooltip）+ 卸载 4 个 radix 依赖。
- errMsg 收口到 `lib/utils`；EngagementBoardSection colors 去重。
- 净减约 600 行。

### 4. `fix(seed)` 信息源补默认抓取配置
- 修「全新部署后没有抓取按钮」：radar-db.json 的源只有展示链接、无 url/enabled，seed 后不可抓。
- 现固化 AX 2026 Artist Alley + AnimeJapan 两个实测能抓的源（browser 策略、enabled）。

### 5. `fix(security)` 系统安全加固
基于一次全面安全评估（详见 `docs/SECURITY.md`）：
- **helmet** 安全响应头 + 精调 **CSP**（default-src 'self'，img 放行截图域名 s.wordpress.com）。
- **全局异常过滤器**：非预期 5xx 对外泛化 + 关联 ID，细节只进日志，防内部信息泄露。
- **CSV 公式注入**防护（导出单元格 `=+-@` 开头加前导单引号）。
- login/改密补 **DTO 校验**（class-validator）+ 改密限流 + 登录防用户枚举（dummy bcrypt）。
- token 有效期 rememberMe 30d → 7d。
- 新增 `docs/SECURITY.md`（安全态势、部署加固清单、残余风险）。

---

## 合并冲突处理（你的改动 vs 我的改动，5 处冲突均保留双方价值）

| 文件 | 处理方式 |
|---|---|
| `extractor.ts` | **你的并发 mapPool + 我的失败块追踪** 结合：并发执行且能正确定位失败块绝对索引 |
| `fetcher.ts` | **整体采用你的版本**（SSRF + 大小上限 + 瞬时重试更完整，自带 assertSafeUrl）。我删掉了自己那份 `url-guard.ts`（功能被你的覆盖、无其他引用） |
| `useCrawl.ts` | **采用你的版本**（抓取触发即返回，避免 12 分钟长轮询——正是我另一处想解决的问题）。仅重新叠加了 `merge → invalidate entities` 一处修复 |
| `crawl.service.ts` 打分 | **你的并发批量回写 + 我的 allowedIds 校验 + status=pending 兜底** 结合 |
| `ContactFinder.tsx` | 合并 import（我的联系方式落库 UI + 你的 copyTimer 清理） |

> 若你发现某处行为和你原本的优化不一致，优先看这张表；我的原则是**不丢你的优化，只在其上叠加安全修复**。有疑问直接找我对。

---

## 数据库协作提醒（沿用既定模型）

- **代码 / 迁移脚本** → 走 git，正常合并。
- **业务数据（行）** → 各自 MySQL，git 不管。你机器上是权威完整库，迁移在你那边跑。
- 不要把数据库 dump 提交进 git（含密钥、体积大、易覆盖对方数据）。
