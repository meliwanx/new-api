# CLAUDE.md — new-api 项目约定

## 项目背景与上游同步

> **本仓库是 New API 的二次开发（fork）版本，不是上游本身。** 改任何代码都要以「能持续合并上游更新」为前提。

- **上游 upstream**：`QuantumNous/new-api`（社区 New API，官方镜像 `calciumion/new-api`）。本仓库 fork 自上游。
- **本仓库 origin**：`meliwanx/new-api`，主分支 `main`。（`git remote -v` 已配置好 `origin` + `upstream`）
- **我们相对上游的主要改造**：
  - 前端整体重设计（黑白科技感 / Vercel 风格，落地页重写）。
  - 多级分销返佣：最多 3 级 + 退款冲正 + 后台可配比例/有效期，附用户端「分销商」页面（`web/default/src/features/affiliate/`）。
  - 生图渠道失败重试等中转增强。
- **保持可合并性的硬性约定**：
  - 改动尽量隔离到**新文件 / 新目录**，少改上游既有文件；必须改时只做最小插入，不重命名/重排上游代码与导出。
  - 前端严格遵循上游目录约定与 i18n 机制（key 即英文源串，改完在 `web/default/` 跑 `bun run i18n:sync`）。
  - 数据库改动遵循下方「规则 2」，保证 SQLite/MySQL/PostgreSQL 三库兼容。
- **同步上游更新的流程**：
  ```bash
  git fetch upstream
  git checkout main
  git merge upstream/main          # 或 git rebase upstream/main
  # 冲突通常集中在：被改过的前端文件、i18n locales、go.mod
  cd web/default && bun install && bun run build && cd ..
  go build .                       # 验证后端可编译
  git push origin main
  ```
  合并后必须本地跑通前后端构建，再按下方「快速打包部署」重新发布到集群。

## 概述

这是一个用 Go 构建的 AI API 网关 / 中转服务。它把 40 多家上游 AI 供应商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等）聚合到统一的 API 之后，提供用户管理、计费、限流以及管理后台。

## 技术栈

- **后端**：Go 1.22+，Gin Web 框架，GORM v2 ORM
- **前端**：React 19、TypeScript、Rsbuild、Base UI、Tailwind CSS
- **数据库**：SQLite、MySQL、PostgreSQL（三者都必须支持）
- **缓存**：Redis（go-redis）+ 内存缓存
- **认证**：JWT、WebAuthn/Passkeys、OAuth（GitHub、Discord、OIDC 等）
- **前端包管理器**：Bun（优先于 npm/yarn/pnpm）

## 架构

分层架构：Router -> Controller -> Service -> Model

```
router/        — HTTP 路由（API、relay、dashboard、web）
controller/    — 请求处理器
service/       — 业务逻辑
model/         — 数据模型与数据库访问（GORM）
relay/         — AI API 中转/代理及各供应商适配器
  relay/channel/ — 供应商专用适配器（openai/、claude/、gemini/、aws/ 等）
middleware/    — 认证、限流、CORS、日志、分发
setting/       — 配置管理（倍率、模型、运营、系统、性能）
common/        — 公共工具（JSON、加密、Redis、env、限流等）
dto/           — 数据传输对象（请求/响应结构体）
constant/      — 常量（API 类型、渠道类型、context key）
types/         — 类型定义（中转格式、文件来源、错误）
i18n/          — 后端国际化（go-i18n，en/zh）
oauth/         — OAuth 供应商实现
pkg/           — 内部包（cachex、ionet）
web/             — 前端主题容器
  web/default/   — 默认前端（React 19、Rsbuild、Base UI、Tailwind）
  web/classic/   — 经典前端（React 18、Vite、Semi Design）
  web/default/src/i18n/ — 前端国际化（i18next，zh/en/fr/ru/ja/vi）
```

## 国际化（i18n）

### 后端（`i18n/`）
- 库：`nicksnyder/go-i18n/v2`
- 语言：en、zh

### 前端（`web/default/src/i18n/`）
- 库：`i18next` + `react-i18next` + `i18next-browser-languagedetector`
- 语言：en（基准）、zh（回退）、fr、ru、ja、vi
- 翻译文件：`web/default/src/i18n/locales/{lang}.json` —— 扁平 JSON，key 即英文源字符串
- 用法：`useTranslation()` hook，在组件中调用 `t('English key')`
- 命令行工具：`bun run i18n:sync`（在 `web/default/` 目录下执行）

## 规则

### 规则 1：JSON 包 —— 使用 `common/json.go`

所有 JSON 的 marshal/unmarshal 操作都**必须**使用 `common/json.go` 中的封装函数：

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

不要在业务代码中直接 import 或调用 `encoding/json`。这些封装是为了保证一致性以及未来的可扩展性（例如切换到更快的 JSON 库）。

注意：`json.RawMessage`、`json.Number` 等来自 `encoding/json` 的类型定义仍可作为类型引用，但实际的 marshal/unmarshal 调用必须走 `common.*`。

### 规则 2：数据库兼容性 —— SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6

所有数据库代码都**必须**同时兼容这三种数据库。

**使用 GORM 抽象：**
- 优先使用 GORM 方法（`Create`、`Find`、`Where`、`Updates` 等），而非裸 SQL。
- 让 GORM 处理主键生成 —— 不要直接使用 `AUTO_INCREMENT` 或 `SERIAL`。

**当裸 SQL 不可避免时：**
- 列引用方式不同：PostgreSQL 用 `"column"`，MySQL/SQLite 用 `` `column` ``。
- 对 `group`、`key` 等保留字列，使用 `model/main.go` 中的 `commonGroupCol`、`commonKeyCol` 变量。
- 布尔值不同：PostgreSQL 用 `true`/`false`，MySQL/SQLite 用 `1`/`0`。使用 `commonTrueVal`/`commonFalseVal`。
- 使用 `common.UsingPostgreSQL`、`common.UsingSQLite`、`common.UsingMySQL` 标志来分支处理数据库专属逻辑。

**没有跨库回退时禁止使用：**
- 仅 MySQL 的函数（如没有 PostgreSQL `STRING_AGG` 等价实现的 `GROUP_CONCAT`）
- 仅 PostgreSQL 的操作符（如 `@>`、`?`、`JSONB` 操作符）
- SQLite 中的 `ALTER COLUMN`（不支持 —— 用加列的方式绕过）
- 没有回退方案的数据库专属列类型 —— JSON 存储用 `TEXT` 而非 `JSONB`

**迁移：**
- 确保所有迁移在三种数据库上都能工作。
- 对 SQLite，使用 `ALTER TABLE ... ADD COLUMN` 而非 `ALTER COLUMN`（参考 `model/main.go` 中的写法）。

### 规则 3：前端 —— 优先使用 Bun

在前端（`web/default/` 目录）中优先使用 `bun` 作为包管理器与脚本执行器：
- `bun install` 安装依赖
- `bun run dev` 启动开发服务器
- `bun run build` 生产构建
- `bun run i18n:*` i18n 工具

### 规则 4：新渠道的 StreamOptions 支持

实现新渠道时：
- 确认该供应商是否支持 `StreamOptions`。
- 如果支持，把该渠道加入 `streamSupportedChannels`。

### 规则 5：上游中转请求 DTO —— 保留显式零值

对于从客户端 JSON 解析、再重新 marshal 转发给上游供应商的请求结构体（尤其是 relay/convert 路径）：

- 可选标量字段**必须**使用指针类型加 `omitempty`（如 `*int`、`*uint`、`*float64`、`*bool`），而非非指针标量。
- 语义必须是：
  - 客户端 JSON 中字段缺失 => `nil` => marshal 时省略；
  - 字段被显式设为 零/false => 非 `nil` 指针 => 仍必须发送给上游。
- 避免对可选请求参数使用「非指针标量 + `omitempty`」，因为零值（`0`、`0.0`、`false`）会在 marshal 时被静默丢弃。

### 规则 6：计费表达式系统 —— 阅读 `pkg/billingexpr/expr.md`

在处理阶梯/动态计费（基于表达式的定价）时，你**必须**先阅读 `pkg/billingexpr/expr.md`。它记录了设计理念、表达式语言（变量、函数、示例）、完整系统架构（编辑器 → 存储 → 预扣费 → 结算 → 日志展示）、token 归一化规则（`p`/`c` 自动排除）、额度换算以及表达式版本管理。所有对计费表达式系统的代码改动都必须遵循该文档描述的模式。

### 规则 7：系统配置与多节点 `OptionMap` 同步

本站是 `master(116)` + `node(58)` 双 app 节点轮询负载均衡，`common.OptionMap` 只是**单进程内存缓存**，不是配置事实来源。改系统管理配置、`/api/option`、`model.UpdateOption`、分层配置或任何依赖 `OptionMap` 的功能时，必须注意：

- 配置写入必须**先落数据库并检查错误**，不能忽略 `FirstOrCreate` / `Save` / `Updates` 等 GORM 错误后仍返回成功，否则前端会出现「提示成功但实际没改」。
- 写库成功后必须更新本节点内存，并通过现有 Redis pub/sub 配置同步机制通知其它节点，或在读取接口返回前从 DB 刷新；不能只改当前节点的 `OptionMap`。
- 后台系统设置保存后前端会立刻重新拉取 `/api/option/`。如果 GET 只读本节点旧内存，在负载均衡下可能打到另一个未同步节点，表现为保存成功但值回退、需要点多次。
- 新增批量配置保存时要使用跨 SQLite/MySQL/PostgreSQL 兼容的事务/upsert；失败必须整体返回错误，不要部分成功后静默吞错。
- 判断配置是否“已保存”要以 DB 或已同步后的读取结果为准，不要把节点本地 `OptionMap` 当作跨节点一致状态。

### 规则 8：供应商充值卡资金隔离

供应商兑换卡存在两套余额，任何改动都必须保持隔离，避免通过买卡/兑卡刷量：

- `users.quota` 是用户普通余额，只能用于 API 消费、普通充值到账、兑换卡兑换到账等正常消费场景。
- `users.supplier_card_quota` 是供应商购卡专属余额，只能由后台管理员调整，只能用于供应商购买兑换卡。
- 供应商购买兑换卡必须扣 `supplier_card_quota`，禁止扣普通 `quota`；普通余额、在线充值到账、兑换卡兑换到账不得直接或间接转成 `supplier_card_quota`。
- 兑换卡被用户兑换后，只增加兑换用户的普通 `quota`，不得增加 `supplier_card_quota`。
- 购卡扣款、后台增加/扣减/覆盖购卡专属余额必须记录 `SupplierCardQuotaLog` 流水，便于后台审计。

## 集群部署（本仓库改造版，站点 onlymeok.com）

> 本仓库是 NewAPI 的**改造版**（前端重设计 + 多级分销等），以独立的「第 4 个站点」部署在 116/58 双机集群上。
> 与服务器上另外 3 个站点（未改源码、用官方镜像 `calciumion/new-api`）架构一致，仅本站使用本仓库源码构建的镜像。
> **所有凭据（服务器 root 密码、数据库/Redis 密码、SESSION/CRYPTO 密钥）只保存在本地未入库文件 `DEPLOYMENT.local.md` 中，绝不提交到本公开仓库。**

### ⚠️ 集群安全红线（绝不能影响其它站点）

116/58 两台机器上**同时运行着多个互相独立的 NewAPI 站点**（如 cluster2、cluster3、官方主站等），它们与本站共用同一台宿主机和同一个 OpenResty 网关。任何部署操作都**只能**触碰本站（cluster4）专属资源：

- **只动本站容器**：`newapi-cluster4-master` / `-postgres` / `-redis` / `newapi-cluster4-node-58`。严禁在其它 `/opt/newapi-*` 目录执行 `docker compose down/up`。
- **严禁全局清理**：绝不使用 `docker system prune`、`docker image prune -a`、`docker volume prune`、`docker network prune` 等会波及其它站点的命令。清理旧镜像只 `docker rmi` 本站镜像。
- **网关只增量改本站块**：`/opt/newapi-ingress/nginx.conf` 是所有站点共用的。改前先带时间戳备份；**只新增/修改 `onlymeok.com` 的 `upstream` 与 `server` 块**，不要碰其它站点的块；**必须原地改写（勿用 mv 换 inode，否则 host bind-mount 失效）**；`docker exec newapi-ingress openresty -t` 通过后再 `openresty -s reload`（平滑重载，不中断其它站点）。
- **防火墙最小化**：firewalld 只为本站 DB/Redis 端口（`15434`/`16402`）放行来源 `116.142.250.58`，不改动其它规则。
- **端口 / 库名唯一**：本站固定 `3103`/`15434`/`16402` 与库 `newapi4`，不与其它站点冲突；新增站点必须另选端口与库名。
- **数据隔离**：本站数据只在 `/data/newapi-extra/cluster4*`，不要触碰其它目录。
- 部署后除确认本站 200 外，顺手 `docker ps` 确认其它站点容器仍 `Up`。

### 服务器与拓扑

- 主机 A（主节点）：`116.142.250.54`（root）—— 运行 app(master) + PostgreSQL + Redis + OpenResty 网关。
- 主机 B（工作节点）：`116.142.250.58`（root）—— 仅运行 app(slave)，连接主机 A 的 PostgreSQL/Redis。
- 单个「站点」即一个集群：`master(116)` + `node(58)` 两个无状态 app 节点共享同一套 PostgreSQL + Redis，前置 OpenResty（`newapi-ingress`，host 网络）做 TLS 终止 + 轮询负载均衡。
- 数据库类型：**PostgreSQL 18**（容器化），Redis 7。全部 Docker 化。

### 本站（cluster4 / onlymeok.com）固定参数

- 镜像：`new-api-onlymeok:latest`（由本仓库源码构建）
- 端口：app `3103`、PostgreSQL `15434`、Redis `16402`
- 容器：`newapi-cluster4-master` / `-postgres` / `-redis`（116）、`newapi-cluster4-node-58`（58）
- 配置目录：116 `/opt/newapi-cluster4`、58 `/opt/newapi-cluster4-node`
- 数据目录：116 `/data/newapi-extra/cluster4`、58 `/data/newapi-extra/cluster4-node`
- 数据库/库名/用户：`newapi4`
- 防火墙：116 的 firewalld 仅放行 `116.142.250.58` 访问 `15434`、`16402`
- 网关：`/opt/newapi-ingress/nginx.conf` 中新增 `upstream newapi_cluster4_backend`（成员 `127.0.0.1:3103` + `116.142.250.58:3103`）与 `onlymeok.com`/`www.onlymeok.com` 的 443 server 块
- 证书：`/opt/newapi-ingress/certs/onlymeok.com.pem` 与 `onlymeok.com.key`
- **DNS：`onlymeok.com`、`www.onlymeok.com` 的 A 记录需指向 `116.142.250.54`**

### 镜像构建要点（与官方 Dockerfile 的差异）

- 本服务器（CentOS 7，CPU 走 bun baseline）上**容器内**执行 `bun run build` 会报 rsbuild「Cannot find module ../dist/index.js」而失败，因此采用 `Dockerfile.deploy`：
  - 前端 `web/default/dist` 在**本地**用 `bun run build` 预编译，随源码一起打包进构建上下文（构建前需移除 `.dockerignore` 中对 `web/*/dist` 的忽略）。
  - 容器内只编译 Go。
  - 由于服务器无法直连 `proxy.golang.org`，构建设置 `GOPROXY=https://goproxy.cn,direct`、`GOSUMDB=off`。

### 快速打包部署（推荐，一条命令）

仓库提供脚本 `scripts/deploy-onlymeok.sh`，一条命令完成：本地构建前端 → 打包上传 → 116 构建镜像 → master 滚动更新 → 镜像分发到 58 → node 滚动更新 → 健康检查。**脚本不含任何密码**，凭据通过环境变量传入（密码见本地 `DEPLOYMENT.local.md`）：

```bash
SSHPASS_MASTER='<116 root 密码>' SSHPASS_NODE='<58 root 密码>' ./scripts/deploy-onlymeok.sh
```

**为什么比手动逐步快很多：**
- `Dockerfile.deploy` 已固定 `GOPROXY=https://goproxy.cn,direct` 与 `GOSUMDB=off`。只要不改 `Dockerfile.deploy` 与 `go.mod/go.sum`，`go mod download` 那层会命中 Docker 层缓存；改业务代码时只重编 `go build` 一层，镜像构建通常只要 20–40s（首次/改依赖才需完整拉取）。
- 镜像分发优先走 **116→58 内网直传**（`docker save | ssh 58 docker load`），免去「116→本地→58」的双向公网中转（之前慢主要慢在这里 + 第一次构建因缺 GOPROXY 失败重来）。
- 一次性免密可让内网直传免输密码（见下）。

**一次性免密（让 116 免密 ssh 到 58，启用内网直传，仅需做一次）：**
```bash
# 在 116 生成密钥并打印公钥
ssh root@116.142.250.54 'test -f ~/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519; cat ~/.ssh/id_ed25519.pub'
# 把输出的公钥追加到 58 的 ~/.ssh/authorized_keys
```
未配置免密时脚本会自动回退为「116→本地→58」中转，仍可用，只是稍慢。

### 发布 / 更新流程（手动分步，脚本不可用时备用）

1. 本地：`cd web/default && bun run build`，再把工作区（含 `dist` 与 `Dockerfile.deploy`、剔除 `.git`/`node_modules`）打成 tar 上传到 116。
2. 116：解包到构建目录，去掉 `.dockerignore` 中对 `web/*/dist` 的忽略，`docker build -f Dockerfile.deploy -t new-api-onlymeok:latest -t new-api-onlymeok:<commit> .`
3. 116：`cd /opt/newapi-cluster4 && docker compose up -d`
4. 分发镜像到 58：116 `docker save | gzip`（优先 `| ssh 58 'docker load'` 内网直传，否则经本地中转）→ 58 `cd /opt/newapi-cluster4-node && docker compose up -d`
5. 网关（**仅当新增/调整本站 server 块时**）：原地改 `/opt/newapi-ingress/nginx.conf` → `openresty -t` → `openresty -s reload`（日常仅更新镜像时无需动网关）
6. 健康检查：`curl http://127.0.0.1:3103/api/status`、`curl http://116.142.250.58:3103/api/status`、`curl --resolve onlymeok.com:443:116.142.250.54 https://onlymeok.com/api/status`
