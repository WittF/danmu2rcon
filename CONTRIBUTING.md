# 🤝 贡献指南

感谢您对 **Danmu2RCON** 项目的关注！我们欢迎所有形式的贡献。

## 🌟 贡献方式

### 🐛 Bug报告
如果您发现了Bug，请：
1. 检查 [Issues](https://github.com/WittF/danmu2rcon/issues) 中是否已有相同问题
2. 如果没有，请创建新的Issue并包含：
   - 详细的Bug描述
   - 复现步骤
   - 期望的行为
   - 实际行为
   - 系统环境信息
   - 相关日志

### 💡 功能建议
我们欢迎新功能的建议：
1. 在 [Discussions](https://github.com/WittF/danmu2rcon/discussions) 中讨论您的想法
2. 说明功能的用途和价值
3. 提供详细的功能描述

### 🔧 代码贡献
1. **Fork** 项目到您的GitHub账户
2. 创建功能分支：`git checkout -b feature/AmazingFeature`
3. 进行您的修改
4. 提交变更：`git commit -m 'Add some AmazingFeature'`
5. 推送到分支：`git push origin feature/AmazingFeature`
6. 创建 **Pull Request**

## 📋 开发准备

### 环境要求
- Node.js 16.0+
- Git
- 一个代码编辑器（推荐VS Code）

### 本地设置
```bash
# 克隆您的fork
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

## 🎯 代码规范

### JavaScript风格
- 使用2个空格缩进
- 使用单引号
- 行尾加分号
- 变量命名使用camelCase
- 常量使用UPPER_CASE

### 示例代码风格
```javascript
// 好的
const eventBridge = new EventBridgeServer(danmuListener);
const MAX_RETRIES = 3;

function handleMessage(data) {
  const message = data.message || '';
  if (message.includes(config.triggerMessage)) {
    processMessage(message);
  }
}

// 不好
const event_bridge=new EventBridgeServer(danmuListener)
const maxRetries=3

function handleMessage(data){
const message=data.message||""
if(message.includes(config.triggerMessage)){
processMessage(message)
}
}
```

### 注释规范
```javascript
/**
 * 处理弹幕消息
 * @param {string} message - 弹幕内容
 * @param {string} username - 用户名
 * @returns {boolean} 是否处理成功
 */
function processMessage(message, username) {
  // 检查是否匹配触发关键词
  if (message === config.triggerMessage) {
    // ... 处理逻辑
    return true;
  }
  return false;
}
```

## 📂 项目结构

```
danmu2rcon/
├── index.js                    # 主服务器文件
├── rcon-client.js             # RCON客户端
├── event-bridge-server.js     # Event Bridge服务
├── danma-listener.js          # 弹幕监听
├── config.js                  # 配置文件
├── package.json               # 项目配置
├── public/                    # 静态文件
└── favicon.ico
├── docs/                      # 文档（如果需要）
└── tests/                     # 测试文件（计划中）
```

## 🧪 测试

目前项目还没有完整的测试套件，但我们欢迎贡献。

### 手动测试
启动项目后测试以下功能：
- [ ] Web界面正常加载
- [ ] RCON连接功能
- [ ] 弹幕监听功能
- [ ] 配置保存功能
- [ ] 事件触发功能

### 计划中的自动化测试
- 单元测试（Jest）
- 集成测试
- E2E测试

## 📝 提交信息规范

使用清晰的提交信息：

```bash
# 格式：类型>: <描述>

🎨 style: 改进Web界面样式
📝 docs: 更新README
🔧 chore: 更新依赖
🧪 test: 添加单元测试
♻️ refactor: 重构事件处理逻辑
🎵 perf: 优化内存使用
```

## 🔍 Pull Request检查清单

提交PR前请确认：

- [ ] 代码遵循项目风格指南
- [ ] 已添加适当的注释
- [ ] 功能经过充分测试
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] 没有遗留调试代码
- [ ] 新功能有相应的配置选项

## 🎯 开发重点

我们特别欢迎以下方面的贡献：

### 🔥 高优先级
- 🧪 测试覆盖率提升
- 📊 性能优化
- 🔒 安全性增强
- 🐛 Bug修复

### 🌟 新功能
- 🎵 音效支持
- 📈 数据统计
- 🌍 多语言支持
- 🔌 插件系统

### 📚 文档
- 🎥 视频教程
- 🖼 截图更新
- 📖 API文档
- 🛠 部署指南

## 📞 获得帮助

如果您有任何问题：

1. 📚 查看 [README.md](README.md)
2. 🔍 搜索 [Issues](https://github.com/WittF/danmu2rcon/issues)
3. 💬 在 [Discussions](https://github.com/WittF/danmu2rcon/discussions) 中提问
4. 📧 发送邮件到：WittF@qq.com

## 🏆 贡献者认证

所有贡献者都将在项目中得到认可！

感谢您的贡献🎉 
