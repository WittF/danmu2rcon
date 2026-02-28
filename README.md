# Danmu2RCON

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

将 B站直播弹幕 实时转换为 Minecraft RCON 命令的桥接工具。观众发弹幕，游戏里就会发生对应的事件。

## 工作原理

```
B站直播间 → LAPLACE Chat → Event Bridge(WebSocket) → Danmu2RCON → Minecraft 服务器(RCON)
```

## 功能概览

- **弹幕触发命令** — 自定义关键词和累计次数，达标后自动执行 RCON 命令
- **SuperChat / 舰长事件** — 监听付费事件并触发游戏内响应
- **随机怪物生成** — 内置 35 种敌对生物，按危险等级智能分配生成距离
- **Web 管理面板** — 实时状态监控、图形化配置编辑、一键测试
- **热更新配置** — 修改配置无需重启，立即生效

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 16+
- 已开启 RCON 的 Minecraft 服务器
- [LAPLACE Chat](https://chat.laplace.live/) 弹幕客户端

### 下载

- **GitHub Releases**: https://github.com/WittF/danmu2rcon/releases

### 安装与启动

```bash
# 克隆仓库（或直接下载压缩包解压）
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon

# 安装依赖
npm install

# 启动
npm start
```

### 连接 LAPLACE Chat

1. 打开 https://chat.laplace.live/
2. 进入 **配置 → 事件服务器**
3. 填入地址 `ws://localhost:9696`
4. 保存并连接

### 打开管理面板

浏览器访问 http://localhost:3000 ，在面板中配置 RCON 连接信息并启动弹幕监听。

## 配置

所有配置保存在 `config.js` 中，也可通过 Web 面板编辑。

### RCON 连接

```json
{
  "rcon": {
    "host": "127.0.0.1",
    "port": 25575,
    "password": "your_rcon_password"
  }
}
```

### 弹幕触发规则

```json
{
  "triggerMessage": "666",
  "commandRules": [
    {
      "name": "随机怪物召唤",
      "count": 10,
      "enabled": true,
      "commands": [
        { "name": "随机怪物生成", "command": "RANDOM_MONSTER_SPAWN" }
      ]
    }
  ]
}
```

`count` 为累计触发阈值 — 观众每发送一次关键词计数 +1，达到阈值后执行命令并重置。

### 事件命令变量

SuperChat 和舰长命令中可使用以下变量：

| 变量 | 说明 | 适用事件 |
|------|------|----------|
| `{username}` | 用户名 | 全部 |
| `{price}` | 金额 | 全部 |
| `{message}` | 留言内容 | SuperChat |
| `{guardType}` | 舰长/提督/总督 | 舰长开通 |
| `{guardIcon}` | 对应图标 | 舰长开通 |
| `{guardColor}` | 对应颜色代码 | 舰长开通 |

### Event Bridge

```json
{
  "eventBridge": {
    "port": 9696,
    "host": "0.0.0.0",
    "authToken": null
  }
}
```

设置 `authToken` 可启用 WebSocket 连接认证。

## 常见问题

**RCON 连接失败** — 确认 Minecraft 服务器已开启 RCON，检查 IP、端口、密码及防火墙设置。

**收不到弹幕** — 确认 LAPLACE Chat 已连接到 `ws://localhost:9696`，且正在监听目标直播间。

**命令未执行** — 检查 RCON 连接状态、命令语法是否正确、目标玩家是否在线。

**Web 面板无法访问** — 检查 3000 端口是否被占用，Node.js 进程是否正常运行。

## 更新

```bash
git pull origin main
npm install
npm start
```

建议更新前备份 `config.js`。

## 贡献

欢迎提交 Issue 和 Pull Request。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致谢

- [籽岷](https://space.bilibili.com/657312) — 提供建议
- [LAPLACE Chat](https://chat.laplace.live/) — 弹幕客户端与 [Event Bridge](https://subspace.institute/docs/laplace-chat/event-bridge) 服务

## 许可证

[MIT](LICENSE)
