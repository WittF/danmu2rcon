# 更新日志

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-06-02

### 🎮 Added
- 📊 新增总累计关键词统计功能
  - 实时统计收到的关键词总数
  - 独立于触发次数的历史记录
  - 前端实时显示累计数据
- 🎯 优化RANDOM_MONSTER_SPAWN功能
  - 排除旁观者模式玩家作为生成目标
  - 使用 `gamemode=!spectator` 选择器
  - 提升游戏体验的合理性

### 🔧 Changed
- 📈 统计概览界面优化
  - "总触发次数" 改为 "总累计次数"
  - 显示接收到的关键词总数而非触发事件总数
  - 更直观的数据展示逻辑
- ⚓ 舰长测试功能精简
  - 移除舰长全部测试功能
  - 保留单独等级测试（总督/提督/舰长）
  - 简化用户界面操作

### 🎯 Removed
- 🎭 删除舰长全部测试功能
  - 移除 `/test-guard-all` 后端路由
  - 删除前端"🎭 全部测试"按钮
  - 移除 `testAllGuardLevels()` 相关函数

### 🐛 Fixed
- 🎮 修复旁观者模式玩家被选中问题
- 📊 修复统计数据显示逻辑
- 🖥️ 优化前端数据更新机制

### 🛠 Technical
- 🔧 增强数据持久性
  - 总累计数不会因重置计数器而丢失
  - 保持历史统计数据的连续性
- 📊 改进状态管理
  - 新增 `totalKeywordCount` 字段
  - 优化前后端数据同步
- 🎯 代码优化
  - 移除冗余测试功能代码
  - 改进玩家选择逻辑

## [1.0.0] - 2025-06-02

### 🎮 Added
- 🎮 完整的B站弹幕监听系统
- 🔧 支持Minecraft RCON协议
- 🌐 现代化Web管理界面
- 📡 Event Bridge WebSocket服务
- 💰 SuperChat事件支持
- 🎯 可配置的弹幕触发规则
- 📊 实时状态监控
- 🔄 自动重连机制

### 🎨 UI/UX
- 💫 美观的自定义tooltip效果
- 🏷 现代化变量标签设计
- 📱 响应式设计支持
- 🎪 流畅的动画效果

### 🛠 Technical
- 🔧 健壮的错误处理机制
- 📝 详细的日志系统
- ⚙️ 可视化配置管理
- 🧪 完整的测试功能

### 📦 Dependencies
- Express.js 4.18.2 - Web服务器框架
- ws 8.14.2 - WebSocket
- rcon 1.1.0 - RCON客户端
- uuid 9.0.1 - UUID生成库

### 🔧 Configuration
- 支持多命令触发规则
- 可配置的事件监听
- 灵活的RCON连接设置
- 可选的认证令牌支持

---

## [Future Releases]

### 计划中的功能
- 📈 数据统计仪表
- 🌍 多语言支持
- 🔔 通知系统

---

### 版本说明格式
- 🎮 **Added** - 新功能
- 🔧 **Changed** - 功能变更
- 🐛 **Fixed** - Bug修复
- 🎯 **Removed** - 移除的功能
- 🔒 **Security** - 安全相关
- ⚠️ **Deprecated** - 将被废弃的功能
