# 🎮 Danmu2RCON - B站弹幕转Minecraft RCON系统

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

一个强大的实时系统，将B站直播弹幕转换为Minecraft游戏内的RCON命令，为直播增加互动性。

## ✨ 主要特性

### 🎯 弹幕触发系统
- **智能关键词匹配** - 自定义触发关键词，累计弹幕自动执行游戏命令
- **多级触发规则** - 支持1次、5次、10次等不同累积触发条件
- **实时计数器** - Web界面实时显示当前累积状态和触发进度

### 💰 特殊事件支持
- **SuperChat监听** - 自动识别并响应超级留言，支持金额和内容变量
- **舰长开通监听** - 监听舰长/提督/总督开通事件，自动感谢支持者
- **自定义命令** - 为每种特殊事件配置专属的游戏内响应

### 🔌 RCON集成
- **智能连接管理** - 自动连接重试、断线重连机制
- **多命令支持** - 单次触发可执行多条RCON命令
- **错误处理** - 完善的异常处理和日志记录

### 🌐 Web管理界面
- **现代化UI** - 响应式设计，支持移动端访问
- **实时监控** - 实时状态显示、日志查看、进度跟踪
- **配置管理** - 图形化配置编辑，所见即所得
- **一键测试** - 内置测试功能，快速验证配置

### 🌉 Event Bridge
- **WebSocket服务** - 与LAPLACE Chat客户端无缝集成
- **认证支持** - 可选的token认证机制
- **事件转发** - 高效的弹幕事件处理和转发

## 🚀 快速开始

### 📥 下载方式

#### GitHub Release（国际用户推荐）
- 前往 [GitHub Releases](https://github.com/WittF/danmu2rcon/releases) 下载最新版本

#### 中国境内镜像（国内用户推荐）
- **镜像下载**：https://pan.wittf.ink/s/ekAfp/
- **注意**：如果提示"无权限访问"，请自行注册账号后下载

### 系统要求
- Node.js 16.0+
- Minecraft服务器（开启RCON）
- LAPLACE Chat弹幕客户端

### 安装步骤

1. **下载项目**
   ```bash
   # 从GitHub克隆（需要Git）
   git clone https://github.com/WittF/danma2rcon.git
   cd danma2rcon
   
   # 或者直接下载压缩包解压使用
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动系统**
   ```bash
   # 使用 npm 启动
   npm start
   
   # 或者手动启动
   node index.js
   ```

4. **配置LAPLACE Chat**
   - 打开 https://chat.laplace.live/
   - 进入 配置 → 事件服务器
   - 填入地址：`ws://localhost:9696`
   - 保存并连接

5. **访问管理界面**
   - 打开浏览器访问：http://localhost:3000
   - 在Web界面中配置RCON连接信息
   - 启动弹幕监听

## ⚙️ 配置说明

### RCON配置
```javascript
{
  "rcon": {
    "host": "127.0.0.1",    // MC服务器地址
    "port": 25575,          // RCON端口
    "password": "your_rcon_password"  // RCON密码
  }
}
```

### 弹幕触发规则
```javascript
{
  "triggerMessage": "666",  // 触发关键词
  "commandRules": [
    {
      "name": "僵尸召唤",
      "count": 1,            // 需要1个"666"触发
      "enabled": true,
      "commands": [
        {
          "name": "生成僵尸",
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:zombie ~ ~ ~"
        },
        {
          "name": "触发消息",
          "command": "/tellraw @a {\"text\":\"💫 弹幕触发！召唤了僵尸！\",\"color\":\"green\"}"
        }
      ]
    }
  ]
}
```

### SuperChat事件
支持以下变量：
- `{username}` - 用户名
- `{price}` - SuperChat金额
- `{message}` - SuperChat内容
- `{guardText}` - 舰长标识

### 舰长开通事件
支持以下变量：
- `{username}` - 用户名
- `{price}` - 开通价格
- `{guardType}` - 舰长类型（舰长/提督/总督）
- `{guardIcon}` - 舰长图标（🚢⚓👑）
- `{guardColor}` - 舰长颜色（aqua/blue/light_purple）

## 🎮 使用示例

### 基础弹幕触发
当观众发送"666"弹幕：
- 1次"666" → 召唤僵尸
- 5次"666" → 召唤卫道士  
- 10次"666" → 召唤坚守者

### SuperChat响应
当收到SuperChat时自动：
- 显示感谢消息
- 播放特殊音效
- 执行自定义命令

### 舰长开通响应
当有人开通舰长时：
- 全服通知
- 播放庆祝音效
- 给予特殊奖励

## 🔧 进阶配置

### 自定义命令变量
在命令中使用变量来实现动态内容：

```javascript
// SuperChat命令示例
"/tellraw @a {\"text\":\"💰 感谢 {username} 的 ¥{price} SuperChat: {message}\",\"color\":\"gold\"}"

// 舰长命令示例  
"/title @a actionbar {\"text\":\"{guardIcon} {username} 开通了{guardType}！\",\"color\":\"{guardColor}\"}"
```

### 多命令序列
单次触发可以执行多个命令：

```javascript
{
  "commands": [
    {
      "name": "生成怪物",
      "command": "/summon minecraft:zombie ~ ~ ~"
    },
    {
      "name": "播放音效", 
      "command": "/playsound minecraft:entity.zombie.ambient master @a"
    },
    {
      "name": "发送消息",
      "command": "/tellraw @a {\"text\":\"怪物来袭！\",\"color\":\"red\"}"
    }
  ]
}
```

### Event Bridge认证
为了安全，可以设置认证token：

```javascript
{
  "eventBridge": {
    "port": 9696,
    "host": "0.0.0.0", 
    "authToken": "your_secret_token"  // 可选
  }
}
```

## 📊 监控和日志

### Web界面功能
- **实时状态** - 显示RCON连接、弹幕监听状态
- **事件计数器** - 实时显示各触发规则的进度
- **系统日志** - 实时显示系统运行日志
- **配置管理** - 图形化编辑所有配置项
- **测试功能** - 一键测试弹幕、SuperChat、舰长等功能

### 日志级别
系统会记录以下信息：
- ✅ 成功连接和操作
- ⚠️ 警告和重试信息  
- ❌ 错误和异常信息
- 📝 详细的调试信息

## 🛠 故障排除

### 常见问题

**Q: RCON连接失败**

A: 检查以下几点：
- MC服务器是否开启RCON
- IP地址和端口是否正确
- RCON密码是否正确
- 防火墙设置

**Q: 弹幕监听不到**  
A: 确认：
- LAPLACE Chat是否正确连接Event Bridge
- WebSocket地址是否正确（ws://localhost:9696）
- 是否在正确的直播间监听

**Q: 触发后没有执行命令**

A: 检查：
- RCON连接是否正常
- 命令语法是否正确
- 玩家是否在线
- 服务器权限设置

**Q: Web界面无法访问**

A: 确认：
- 端口3000是否被占用
- 防火墙是否阻止
- Node.js是否正常运行

### 调试模式
启用详细日志：
```bash
DEBUG=* node index.js
```

## 🔄 更新和维护

### 备份配置
重要配置保存在`config.js`中，更新前建议备份：
```bash
cp config.js config.js.backup
```

### 更新步骤
```bash
git pull origin main
npm install
npm start
```

## 🤝 贡献指南

我们欢迎各种形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发环境设置
```bash
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon
npm install
npm run dev  # 开发模式启动
```

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)。

## 🙏 致谢

- 籽岷 - 提供建议
- [LAPLACE Chat](https://chat.laplace.live/) - 提供优秀的弹幕客户端和[Event Bridge](https://subspace.institute/docs/laplace-chat/event-bridge)服务
- 所有贡献者和用户的支持

---

**🎮 让您的Minecraft直播更加精彩！** ✨ 
