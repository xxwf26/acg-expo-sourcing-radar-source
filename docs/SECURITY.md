# 安全说明与加固记录 · ACG 采购寻源雷达

本文件记录系统的安全态势、已实施的加固、以及待办与部署注意事项。定位：小团队内部工具（少量账号）。

最近评估：2026-07-03。

## 安全基线（已验证良好）

- **认证**：JWT，密钥必填且启动强制校验；密码 bcrypt(10)。
- **授权**：读操作登录即可（含 viewer），**所有写操作 `@Roles('admin')` + RolesGuard**；JWT strategy 每次回查数据库取 role，不信任 token 内 role（改 token 无法提权）。
- **注入**：Drizzle 全参数化，无裸 SQL 拼接；关键词搜索已转义 LIKE 通配符。
- **Mass-assignment**：全局 `ValidationPipe({ whitelist: true })`，DTO 未声明字段被剥离。
- **XSS**：AI 输出用 react-markdown 且未启用 rehype-raw，不渲染裸 HTML；无 `dangerouslySetInnerHTML`/`eval`。
- **SSRF**：抓取层 `fetcher.ts` 校验协议 + DNS 解析后逐 IP 拦私有/保留段，重定向手动逐跳复校验。

## 已实施的加固

| 项 | 说明 | 位置 |
|---|---|---|
| SSRF 防护 | 抓取 URL 协议 + 私有 IP 拦截 + 逐跳重定向校验 + 瞬时错误重试 | `crawl/fetcher.ts` |
| 默认口令 | seed 初始口令改从 env 读，无则随机生成，不再硬编码 | `database/seed-users.ts` |
| CSV 公式注入 | 导出单元格 `=+-@` 等开头加前导单引号中和 | `EngagementBoardSection.tsx` |
| 安全响应头 | helmet（X-Frame-Options / nosniff / HSTS 等） | `main.ts` |
| 全局异常过滤 | 非预期 5xx 对外泛化 + 关联 ID，细节只进日志 | `common/filters/all-exceptions.filter.ts` |
| 改密限流 | `PUT /api/auth/password` 按用户 10 次/分 | `auth/auth.controller.ts` |
| 抓取大小上限 | 响应体流式读取超上限(HTML 20MB/PDF 50MB)中止，防 OOM DoS | `crawl/fetcher.ts` `safeFetch` |
| 登录限流 | 按 IP 5 次/分 | `auth/auth.controller.ts` |
| CSP | helmet 精调 CSP：default-src 'self'，img 放行 s.wordpress.com，style 'unsafe-inline' | `main.ts` |
| auth 入参校验 | login/改密改用 LoginDto/ChangePasswordDto（class-validator），拒畸形/超长 payload | `auth/auth.dto.ts` |
| 防用户枚举 | 用户不存在时也跑 dummy bcrypt.compare，抹平时序侧信道 | `auth/auth.service.ts` |
| token 有效期 | rememberMe 30d → 7d，缩小 localStorage token 被盗窗口 | `auth/auth.service.ts` |

## 密钥管理（重要）

- `server/.env` 含 DB 口令、JWT 密钥、AI 网关 Key，**已 gitignore、未进 git**。
- **风险**：明文落盘，随目录拷贝/备份/外发即泄露。JWT 密钥泄露可离线伪造 admin token；AI Key 可被盗刷额度。
- **要求**：
  - 切勿把 `.env` 发给任何外部工具/人，切勿提交。
  - 疑似泄露立即轮换：AI Key 到网关后台吊销重签；DB 改口令；JWT 重新生成（`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`，会使现有登录失效需重登）。
  - 生产尽量用系统环境变量/密钥管理注入，减少明文落盘。

## 部署加固清单

1. **`SERVER_HOST`**：仅本机用填 `127.0.0.1`；需外部访问填 `0.0.0.0` 但**必须**前置反向代理（只暴露 443）+ 防火墙白名单，勿裸奔。
2. **`CORS_ORIGINS`**：生产显式配置为真实域名，不依赖内置 localhost 兜底。
3. **HTTPS**：由反向代理终止 TLS。
4. **初始口令**：`SEED_ADMIN_PASSWORD`/`SEED_VIEWER_PASSWORD` 显式设置或用随机值，首次登录后立即改密。
5. **每周自动抓取**：`CRAWL_WEEKLY_ENABLED` 默认关闭，按需开启。

## 待办 / 已知残余风险（P3，内部工具可接受现状）

- **JWT 存 localStorage**：XSS 可窃取；有效期已收敛（记住我 7 天、否则 8 小时）但无服务端吊销（登出仅清本地）。缓解：CSP 已上线降低 XSS 面、无已知 XSS 落点；如需更强可迁移 HttpOnly cookie。
- **抓取/AI 错误文案**：`crawl_runs.error`、AI 失败信息含底层 message，会回传前端。因均为 **admin-only** 且运维需要，暂保留；如收紧可改为泛化文案。
- **依赖漏洞**：`npm audit` 后端 multer/qs（传递依赖，破坏性升级）、前端 esbuild/vite（仅 dev 面）。`npm audit fix` 处理非破坏性项，大版本升级单独排期验证。

## 定期检查建议

- 每次上线前 `npm audit`；季度性复核本文件。
- 新增渲染用户/抓取内容的 UI 时，确认不引入 XSS（勿用 rehype-raw / dangerouslySetInnerHTML）。
- 新增导出功能时，套用 `csvCell` 的公式注入防护。
