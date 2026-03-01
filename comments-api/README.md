# 留言后端（匿名可用）- Cloudflare Workers + D1

这个目录提供一个简单的“留言 API”，用于替换首页当前的 `localStorage` 留言，让所有访问者都能看到同一份留言数据（无需登录）。

## 1) 前置要求

- 一个 Cloudflare 账号
- 本机已安装 Node.js
- 安装 Wrangler：`npm i -g wrangler`

## 2) 创建 D1 数据库并建表

在本目录运行：

```bash
wrangler login
wrangler d1 create mmc_comments
```

然后把输出中的 `database_id` 填进 `wrangler.toml`（见下一步）。

创建数据表：

```bash
wrangler d1 execute mmc_comments --file=./schema.sql
```

## 3) 配置并部署 Worker

复制配置文件：

```bash
copy wrangler.toml.example wrangler.toml
```

编辑 `wrangler.toml`，填写你的 `database_id`，并按需设置允许的站点来源（CORS）。

部署：

```bash
wrangler deploy
```

部署完成后会得到一个访问地址（例如 `https://xxx.workers.dev`），把它配置到站点首页的 `meta[name="comment-api-base"]`（见仓库根目录 `README.md`）。

