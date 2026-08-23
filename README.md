# SaaS 竞品分析工具 · 上线版 V1.0.0

> 基于 DeepSeek 的 SaaS 竞品分析单页应用，可一键部署到 Vercel。用户自带 DeepSeek API Key，前端经本站 Serverless 代理转发（密钥仅内存透传、不落库），分析结果与行为埋点分离，埋点落库 Supabase。

---

## ① 项目简介

本工具帮助用户快速生成结构化的 SaaS 竞品分析报告：输入公司 / 产品 / 行业品类，自动识别意图（单产品 vs 赛道），输出包含可交互图表的竞品分析报告，支持模板自定义、高级配置、本地报告历史、增量对比高亮、PDF / HTML 导出。

**技术形态**
- 纯前端单页应用（`index.html`），B 端专业风格，Inter 字体，主色 `#2563eb`。
- Vercel Serverless Functions 两个接口：`/api/proxy.js`（解决 DeepSeek CORS 跨域 + 安全转发）、`/api/event.js`（行为埋点接收 + Supabase 写入）。
- 全部用户私有数据（API Key、模板、报告历史）仅存浏览器 `localStorage`，不上传任何服务器（代理仅内存转发密钥到 DeepSeek 后即刻丢弃）。

**核心业务功能（全部保留）**
1. API Key 配置面板：用户输入自己的 DeepSeek API Key；模型下拉 `DeepSeek-v4-fresh` / `DeepSeek-v4-Pro`；连通性测试。
2. 搜索主交互 + 输入意图自动识别（单产品 / 行业品类），品类识别弹出二次确认弹窗。
3. 模板管理：在线编辑、一键恢复默认。
4. 高级配置表单，每项带 hover 问号提示。
5. 本地报告历史（`localStorage`）。
6. 骨架屏加载、增量更新高亮（新增绿色竖线、修改黄色竖线）。
7. 可交互图表；PDF 导出强制图表转静态图片 + onload 等待 + 超时兜底，杜绝空白；HTML 下载保留交互图表。
8. API Key 仅存浏览器本地，**绝不上传任何服务器**（代理仅内存转发）。

---

## ② 本地存放路径提示

请将全部源代码保存至：

```
D:\Desktop\saas竞品分析产品\上线版V1.0.0
```

严格遵守以下目录结构：

```
saas竞品分析产品/上线版V1.0.0\
├─ index.html
├─ vercel.json
├─ README.md
├─ .gitignore
└─ api\
   ├─ proxy.js
   └─ event.js
```

---

## ③ 完整操作步骤

### 1）保存源代码
把上面全部文件按目录结构保存到 `D:\Desktop\saas竞品分析产品\上线版V1.0.0`（注意 `api` 是一个文件夹，里面放 `proxy.js` 与 `event.js`）。

### 2）Supabase 建表 + 取密钥
1. 打开 https://supabase.com 新建一个项目。
2. 进入项目左侧 **SQL Editor**，粘贴下方「建表 SQL」并执行，创建 `product_events` 埋点表。
3. 进入 **Project Settings → API**，复制：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `service_role` 密钥（**仅服务端使用，绝不暴露给前端、绝不提交到仓库**）

### 3）推送代码到 GitHub
将 `上线版V1.0.0` 内全部文件提交到一个 **GitHub 公开仓库**（不要把 `.env` / 密钥提交进去，`.gitignore` 已拦截）。

### 4）Vercel 导入部署
1. 打开 https://vercel.com，选择 **Add New → Project → 导入你的 GitHub 仓库**。
2. Framework Preset 选 `Other`，其余默认即可（根目录静态托管 + `api/` 自动识别为 Serverless Function）。
3. 进入 **Settings → Environment Variables**，新增变量：
   - `SUPABASE_URL` = 你的 Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = 你的 service_role 密钥
   - `ALLOWED_ORIGINS`（可选）= 你的站点域名，多个用逗号分隔，例如 `https://your-site.vercel.app,https://your-domain.com`
4. 点击 **Deploy**。部署完成后访问分配的 `.vercel.app` 域名即可使用。

---

## ④ 安全说明文档

> 本工具消耗访问者**自己的** DeepSeek API 额度；网站本身**不内置任何 API 密钥**。

- **用户 API 密钥**：仅保存在访问者浏览器 `localStorage`。发起分析时，密钥随请求头 `Authorization: Bearer <key>` 发送到本站 Vercel 代理（`/api/proxy`），代理**仅在本请求内存中**将其转发给 DeepSeek 官方接口，处理结束即被垃圾回收，**不打印日志、不写入变量文件、不写入数据库**。
- **代理防滥用**：目标地址硬编码为 DeepSeek 官方接口，拒绝转发任何其他第三方 URL，避免被当做通用 HTTP 跳板；按 IP 做每分钟频率限流；仅允许 `ALLOWED_ORIGINS`（含 `*.vercel.app`）来源调用。
- **埋点隐私**：行为埋点只记录产品交互行为，**绝不采集** API Key、报告全文、完整模板文本、完整高级配置描述。后端 `event.js` 对请求体做敏感字段闸门（命中即拒绝写入），并仅保留白名单字段且截断字符串。
- **Supabase 密钥**：`service_role` 密钥仅存在于 Vercel 环境变量与服务器端，前端代码与环境变量中均无明文；本项目 `.gitignore` 已阻止 `.env` 与密钥文件入库。
- **⚠️ 严禁**：把任何 API 密钥硬编码写进代码、把 `.env` / 密钥提交到 GitHub、把 `service_role` 暴露给前端。

---

## ⑤ 上线测试检查清单

- [ ] 站点可正常打开，B 端界面布局正常，骨架屏 / 空状态 / 错误状态显示正确。
- [ ] 未配置 API Key 时，搜索按钮置灰，点击提示前往 API 设置。
- [ ] 填写 DeepSeek API Key 并「测试连通性」→ 显示成功。
- [ ] 搜索单产品（如 `Notion`）→ 直接出报告，含可交互图表。
- [ ] 搜索行业品类（如 `跨境电商 ERP`）→ 弹出二次确认弹窗，确认后生成赛道报告。
- [ ] 高级配置表单每项 hover 问号有业务含义提示；空字段有高亮但不阻断提交。
- [ ] 模板编辑保存后，下一次搜索复用；「恢复默认模板」生效。
- [ ] 报告历史可点击重新打开；重新生成报告时出现绿色/黄色增量高亮。
- [ ] 导出 PDF：图表均转为静态图片，无大面积空白；导出 HTML：保留交互图表。
- [ ] PDF 导出时断网 / 图表加载慢 → 超时兜底提示「图表内容无法导出，请参考网页版本查看交互式图表」。
- [ ] 配置 Supabase 后，前端操作后 `product_events` 表产生对应事件行（且不含任何密钥/报告内容）。
- [ ] 检查 Supabase 表中任意行均无 `api_key` / `template` / `report` 等敏感字段。

---

## ⑥ 埋点数据分析工作流 & 数据库升级路径

### 6.1 Supabase 建表 SQL（直接复制执行）

```sql
-- 行为埋点表
create table if not exists public.product_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  event       text not null,
  payload     jsonb,
  origin      text,
  ua          text,
  ip          text
);

-- 仅服务端 service_role 写入；开启 RLS 阻止匿名读取，杜绝数据外泄
alter table public.product_events enable row level security;

-- （可选）为常用分析建索引
create index if not exists idx_events_created on public.product_events (created_at);
create index if not exists idx_events_name on public.product_events (event);
```

> Supabase REST 写入使用 `service_role`，会自动绕过 RLS；前端只调用本站 `/api/event`，**不持有**任何 Supabase 密钥，因此无法越权读取。

### 6.2 常用分析 SQL 样例

```sql
-- 每日搜索成功趋势（最近 30 天）
select date(created_at) as day,
       count(*) filter (where event = 'search_success') as success,
       count(*) filter (where event = 'search_trigger') as trigger
from product_events
where created_at >= now() - interval '30 days'
group by day
order by day;

-- 赛道模式占比（category vs single）
select payload->>'analysis_mode' as mode,
       count(*) as cnt
from product_events
where event = 'search_trigger'
group by mode;

-- 模型使用占比
select payload->>'model_name' as model,
       count(*) as cnt
from product_events
where event in ('search_trigger','search_success')
group by model
order by cnt desc;

-- 错误分类统计
select payload->>'error_type' as err_type,
       count(*) as cnt
from product_events
where event = 'search_fail'
group by err_type
order by cnt desc;

-- 功能使用漏斗（导出/历史等）
select event, count(*) as cnt
from product_events
where event in ('click_export_pdf','click_export_html','history_item_click','click_advanced_config')
group by event;
```

### 6.3 在 Supabase 后台搭建数据看板

1. 进入 Supabase **SQL Editor** 运行上面样例 SQL，确认数据正常。
2. 进入 **Database → Tables → product_events**，使用 Table View 直接浏览原始事件。
3. 看板方式二选一：
   - 简单看板：用 **Supabase + 外部 BI**（如 Metabase、Grafana）连接 Postgres 只读副本，拖拽生成图表。
   - 内置看板：在 **Edge Functions / 自建接口** 暴露聚合接口，前端用 Chart.js 渲染（与本项目图表能力一致）。
4. 建议把上述 SQL 固化为 **Materialized View**（物化视图）并定时 `refresh`，提升看板查询性能。

### 6.4 MVP 埋点数据分析完整工作流

```
前端埋点 (track)  ──POST──▶  /api/event.js  ──▶  Supabase.product_events
                                              │
                                              ▼
                          SQL 聚合 / 物化视图 ──▶ BI 看板 / 图表
```

1. **采集**：前端严格白名单事件（10 类），不上报隐私。
2. **接收**：`event.js` 做敏感字段闸门 + 字段白名单 + 截断，写入 Supabase。
3. **存储**：`product_events` 原始事件表（append-only）。
4. **分析**：SQL 聚合 / 物化视图生成指标。
5. **呈现**：BI 看板或自建图表展示每日趋势、模式占比、模型占比、错误分布、功能漏斗。
6. **迭代**：基于漏斗与错误分布优化产品（如错误率高的模型、使用率低的功能）。

### 6.5 后期数据库升级路径（备选方案）

- **Umami（开源隐私友好分析）**：当仅需产品级流量 / 行为分析、不想自建埋点表时，可直接接入 [Umami](https://umami.is)（自托管或云），替换自研埋点。本项目已把埋点抽象为 `track()` 单一入口，切换到 Umami 只需把 `track()` 内部实现替换为 Umami 的 `umami.track()` 即可，无需改动业务代码。
- **Postgres 扩展**：数据量增长后可启用 Supabase **Read Replicas** 给 BI 只读查询，主库只写。
- **实时管道**：接入 **Supabase Realtime / Kafka / ClickHouse**，将事件流式导入列式存储做海量行为分析。
- **密钥管理升级**：Vercel 环境变量已满足 MVP；更高安全要求可接入 **Vault / AWS Secrets Manager** 动态注入。

---

## 环境变量汇总（Vercel）

| 变量名 | 说明 | 是否必填 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目 URL | 启用埋点必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 密钥（仅服务端） | 启用埋点必填 |
| `ALLOWED_ORIGINS` | 允许调用接口的来源域名，逗号分隔 | 可选，默认放行 `*.vercel.app` 与 `localhost:3000` |
| `DEEPSEEK_BASE_URL` | DeepSeek 官方基础地址 | 可选，默认 `https://api.deepseek.com` |

---

## 本地预览（可选）

```bash
# 使用 Vercel CLI 本地启动（可同时跑静态页与 /api 函数）
npm i -g vercel
vercel dev
# 浏览器访问 http://localhost:3000
```

> 注意：直接双击打开 `index.html`（file://）无法调用 `/api/*` 接口，需通过本地服务器或 Vercel 预览访问。
