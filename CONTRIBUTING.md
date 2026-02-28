# 贡献指南

感谢你对 Danmu2RCON 的关注，欢迎提交 Issue 和 Pull Request。

## Bug 报告

提交前请先搜索 [已有 Issue](https://github.com/WittF/danmu2rcon/issues)，避免重复。新建 Issue 时请包含：

- Bug 描述和复现步骤
- 期望行为 vs 实际行为
- 系统环境（OS、Node.js 版本）
- 相关日志

## 代码贡献

```bash
# 1. Fork 并克隆
git clone https://github.com/<your-username>/danmu2rcon.git
cd danmu2rcon
npm install

# 2. 创建分支
git checkout -b feature/your-feature

# 3. 开发（支持热重载）
npm run dev

# 4. 提交并推送
git commit -m "feat: 你的改动描述"
git push origin feature/your-feature

# 5. 创建 Pull Request
```

## 项目结构

```
index.js                  # 主服务器（Express + API）
rcon-client.js            # RCON 客户端与怪物生成逻辑
danma-listener.js         # 弹幕监听与规则计数
event-bridge-server.js    # Event Bridge WebSocket 服务
config.js                 # 配置文件
public/                   # 前端静态资源
```

## 代码规范

- 2 空格缩进，单引号，行尾分号
- 变量 `camelCase`，常量 `UPPER_CASE`
- 提交信息格式：`类型: 描述`（如 `feat: 新增XX`、`fix: 修复XX`、`docs: 更新文档`）

## PR 检查清单

- [ ] 遵循项目代码风格
- [ ] 经过功能测试
- [ ] 更新了相关文档
- [ ] 无遗留调试代码

## 联系

- [Issues](https://github.com/WittF/danmu2rcon/issues)
- [Discussions](https://github.com/WittF/danmu2rcon/discussions)
- 邮箱：WittF@qq.com
