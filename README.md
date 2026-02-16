# Minecraft Mod Create

这是一个基于 GitHub Pages 的 Minecraft 模组制作教程站。

## 当前结构

- 教程主页面：最新更新内容 + 用户留言区（本地存储）

- 第一章：初窥门径（已搭建框架，内容待导入）
  - 第一节：开发环境构建
  - 第二节：学会查看官方代码
  - 第三节：开始制作自己的 Mod
    - 第一点：制作模组的第一个物品
    - 第二点：制作自己模组的创造模式物品栏
    - 第三点：resources 文件的构建

## 目录结构

- `index.html`：教程主页面（更新 + 留言）
- `guides/chapter-select.html`：章节选择页面（中间页）
- `styles/main.css`：全站样式
- `scripts/main.js`：首页交互（含侧边栏）
- `guides/*.html`：章节与小节框架页

## 部署到 GitHub Pages

1. 把本目录所有文件上传到仓库 `Xiyue23333/Xiyue23333.github.io` 的 `main` 分支根目录。
2. 在仓库 `Settings -> Pages` 中确认：
   - Source: `Deploy from a branch`
   - Branch: `main` / `/root`
3. 提交后等待 1-3 分钟，访问：
   - `https://xiyue23333.github.io/`

