# Changelog

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.2] - 2025-06-03

### Added

- 新增 22 种敌对生物，怪物库扩展至 35 种（涵盖几乎所有敌对生物，除末影龙）
- 智能距离生成：低危 0-3 格、中危 2-3 格、高危 4-5 格，按威胁等级分配
- 怪物跟踪范围优化至 32 格（原版 16 格），附带 10 秒发光效果辅助锁定

### Changed

- 调整危险等级分配：恼鬼、幻魔者升至高危；劫掠兽、蛮兵调至中危
- 日志输出增加距离策略和 AI 优化状态信息

### Fixed

- 修复热更新配置后进度条上限不更新的问题，实现真正的无重启配置刷新
- 修复前端状态同步：配置保存后立即更新进度条显示

## [1.0.1] - 2025-06-02

### Added

- 新增总累计关键词统计，独立于触发次数，支持前端实时显示

### Changed

- 统计概览中"总触发次数"改为"总累计次数"，展示更直观
- 精简舰长测试功能，移除全部测试按钮，保留单独等级测试

### Fixed

- 修复旁观者模式玩家被选为怪物生成目标的问题
- 修复统计数据显示逻辑和前端数据更新机制

## [1.0.0] - 2025-06-02

### Added

- B站弹幕监听与 Minecraft RCON 命令桥接
- 可配置的弹幕触发规则（关键词 + 累计次数）
- SuperChat 和舰长开通事件监听与自动响应
- Event Bridge WebSocket 服务，对接 LAPLACE Chat
- Web 管理界面：实时监控、配置编辑、一键测试
- 自动重连机制

[1.0.2]: https://github.com/WittF/danmu2rcon/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/WittF/danmu2rcon/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/WittF/danmu2rcon/releases/tag/v1.0.0
