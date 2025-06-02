const express = require('express');
const RconClient = require('./rcon-client');
const DanmuListener = require('./danma-listener');
const EventBridgeServer = require('./event-bridge-server');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// 创建Express应用
const app = express();
app.use(express.json());
app.use(express.static('public')); // 静态文件服务

// 创建RCON客户端、弹幕监听器和Event Bridge服务器
const rconClient = new RconClient();
const danmuListener = new DanmuListener(rconClient);
const eventBridgeServer = new EventBridgeServer(danmuListener);

// 应用状态
let appStarted = false;

// 全局日志收集器
let systemLogs = [];
const MAX_LOGS = 100;

// 重写console.log来收集日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const timestamp = new Date().toLocaleTimeString();
  const message = args.join(' ');
  systemLogs.push(`[${timestamp}] ${message}`);
  if (systemLogs.length > MAX_LOGS) {
    systemLogs.shift();
  }
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const timestamp = new Date().toLocaleTimeString();
  const message = args.join(' ');
  systemLogs.push(`[${timestamp}] ERROR: ${message}`);
  if (systemLogs.length > MAX_LOGS) {
    systemLogs.shift();
  }
  originalConsoleError.apply(console, args);
};

// 启动应用
async function startApp() {
  if (appStarted) {
    console.log('应用已启动');
    return;
  }

  console.log('🚀 启动弹幕2RCON系统...');
  console.log('=====================================');
  console.log(`RCON服务器: ${config.rcon.host}:${config.rcon.port}`);
  console.log(`触发关键词: "${config.triggerMessage}"`);
  console.log(`Event Bridge端口: ${config.eventBridge.port}`);
  console.log('触发规则:');
  config.commandRules.forEach(rule => {
    const commandCount = rule.commands ? rule.commands.length : 1;
    console.log(`  - ${rule.count}个"${config.triggerMessage}" -> ${rule.name} (${commandCount}个命令)`);
  });
  console.log('=====================================');

  try {
    // 启动Event Bridge服务器（独立于RCON）
    eventBridgeServer.start();
    
    appStarted = true;
    console.log('✅ 系统启动成功！');
    console.log('ℹ️  RCON将在开始监听时自动连接');
    console.log(`📋 LAPLACE Chat配置说明：`);
    console.log(`   1. 打开 https://chat.laplace.live/`);
    console.log(`   2. 进入配置 → 事件服务器`);
    console.log(`   3. 填入地址: ws://localhost:${config.eventBridge.port}`);
    if (config.eventBridge.authToken) {
      console.log(`   4. 认证令牌: ${config.eventBridge.authToken}`);
    } else {
      console.log(`   4. 无需认证令牌`);
    }
    console.log(`   5. 保存并连接`);
  } catch (error) {
    console.error('❌ 系统启动失败:', error.message);
  }
}

// API路由

// 获取系统状态
app.get('/api/status', (req, res) => {
  const status = {
    app: {
      started: appStarted,
      config: {
        triggerMessage: config.triggerMessage,
        rconHost: config.rcon.host,
        rconPort: config.rcon.port,
        eventBridgePort: config.eventBridge.port
      }
    },
    rcon: {
      connected: rconClient.isConnected
    },
    danmu: danmuListener.getStatus(),
    eventBridge: eventBridgeServer.getStatus()
  };
  
  res.json(status);
});

// 获取系统日志
app.get('/api/logs', (req, res) => {
  res.json({ logs: systemLogs });
});

// 获取配置
app.get('/api/config', (req, res) => {
  res.json(config);
});

// 更新配置
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    
    // 验证配置格式
    if (!newConfig.rcon || !newConfig.rcon.host || !newConfig.rcon.port) {
      return res.status(400).json({ success: false, message: 'RCON配置不完整' });
    }
    
    // 验证怪物规则
    if (!Array.isArray(newConfig.commandRules) || newConfig.commandRules.length === 0) {
      return res.status(400).json({ success: false, message: '怪物规则配置不正确' });
    }
    
    console.log('🔄 开始配置热更新...');
    
    // 更新内存中的配置
    Object.assign(config, newConfig);
    
    // 保存到文件
    const configContent = `// 配置文件
module.exports = ${JSON.stringify(config, null, 2)};`;
    
    fs.writeFileSync(path.join(__dirname, 'config.js'), configContent, 'utf8');
    console.log('💾 配置文件已保存');
    
    // 执行各模块的热更新
    const updateResults = [];
    
    try {
      // 1. 更新RCON客户端配置
      console.log('📡 更新RCON配置...');
      const rconResult = await rconClient.updateConfig(newConfig);
      updateResults.push({ module: 'RCON', success: rconResult });
      
      // 2. 更新弹幕监听器配置
      console.log('🎯 更新弹幕监听配置...');
      const danmuResult = danmuListener.updateConfig(newConfig);
      updateResults.push({ module: '弹幕监听', success: danmuResult });
      
      // 3. 更新Event Bridge配置
      console.log('🌉 更新Event Bridge配置...');
      const bridgeResult = await eventBridgeServer.updateConfig(newConfig);
      updateResults.push({ module: 'Event Bridge', success: bridgeResult });
      
      // 检查所有更新是否成功
      const allSuccess = updateResults.every(result => result.success);
      const failedModules = updateResults.filter(result => !result.success).map(result => result.module);
      
      if (allSuccess) {
        console.log('✅ 配置热更新成功，所有模块已应用新配置');
        res.json({ 
          success: true, 
          message: '配置已更新并热重载，无需重启服务',
          hotReload: true,
          updateResults: updateResults
        });
      } else {
        console.log(`⚠️ 配置热更新部分成功，失败模块: ${failedModules.join(', ')}`);
        res.json({ 
          success: true, 
          message: `配置已更新，部分模块热重载失败: ${failedModules.join(', ')}`,
          hotReload: true,
          updateResults: updateResults,
          warnings: failedModules
        });
      }
      
    } catch (error) {
      console.error('❌ 配置热更新过程中出错:', error.message);
      res.status(500).json({ 
        success: false, 
        message: '配置热更新失败: ' + error.message,
        hotReload: false
      });
    }
    
  } catch (error) {
    console.error('❌ 配置保存失败:', error.message);
    res.status(500).json({ success: false, message: '保存配置失败: ' + error.message });
  }
});

// 重置配置为默认值
app.post('/api/config/reset', (req, res) => {
  try {
    const defaultConfig = {
      rcon: {
        host: '127.0.0.1',
        port: 25575,
        password: 'Rcon@PSWD'
      },
      triggerMessage: '666',
      eventSettings: {
        superChatEnabled: true,
        guardPurchaseEnabled: true,
        // SuperChat事件配置
        superChatCommands: [
          {
            name: 'SuperChat通知',
            enabled: true,
            command: '/title @a actionbar {"text":"💰 {username} 发送了 ¥{price} 的SuperChat","color":"gold"}'
          },
          {
            name: 'SuperChat聊天',
            enabled: true,
            command: '/tellraw @a {"text":"💰 [SC] ","color":"gold","extra":[{"text":"{username}: {message}","color":"yellow"}]}'
          },
          {
            name: 'SuperChat音效',
            enabled: true,
            command: '/playsound minecraft:block.note_block.chime master @a ~ ~ ~ 0.5 1.2'
          }
        ],
        // 舰长开通事件配置
        guardCommands: [
          {
            name: '舰长通知',
            enabled: true,
            command: '/title @a actionbar {"text":"{guardIcon} {username} 开通了{guardType} (¥{price})","color":"yellow"}'
          },
          {
            name: '舰长聊天',
            enabled: true,
            command: '/tellraw @a {"text":"{guardIcon} ","color":"{guardColor}","extra":[{"text":"{username}","color":"gold"},{"text":" 开通了 ","color":"white"},{"text":"{guardType}","color":"{guardColor}","bold":true},{"text":"！感谢支持！","color":"yellow"}]}'
          },
          {
            name: '舰长音效',
            enabled: true,
            command: '/playsound minecraft:block.note_block.bell master @a ~ ~ ~ 0.8 1.5'
          }
        ]
      },
      commandRules: [
        {
          name: '僵尸召唤',
          count: 1,
          enabled: true,
          commands: [
            {
              name: '生成僵尸',
              enabled: true,
              command: '/execute at @a[name="WittF"] run summon minecraft:zombie ~ ~ ~'
            },
            {
              name: '触发消息',
              enabled: true,
              command: '/tellraw @a {"text":"💫 弹幕触发！召唤了僵尸！","color":"green"}'
            },
            {
              name: '庆祝音效',
              enabled: true,
              command: '/playsound minecraft:entity.experience_orb.pickup master @a ~ ~ ~ 0.8 1.0'
            }
          ]
        },
        {
          name: '卫道士召唤',
          count: 5,
          enabled: true,
          commands: [
            {
              name: '生成卫道士',
              enabled: true,
              command: '/execute at @a[name="WittF"] run summon minecraft:vindicator ~ ~ ~'
            },
            {
              name: '触发消息',
              enabled: true,
              command: '/tellraw @a {"text":"⚔️ 弹幕触发！召唤了卫道士！","color":"red"}'
            },
            {
              name: '特殊音效',
              enabled: true,
              command: '/playsound minecraft:entity.vindicator.ambient master @a ~ ~ ~ 1.0 1.0'
            }
          ]
        },
        {
          name: '坚守者召唤',
          count: 10,
          enabled: true,
          commands: [
            {
              name: '生成坚守者',
              enabled: true,
              command: '/execute at @a[name="WittF"] run summon minecraft:warden ~ ~ ~'
            },
            {
              name: '触发消息',
              enabled: true,
              command: '/tellraw @a {"text":"💀 弹幕触发！召唤了恐怖的坚守者！","color":"dark_purple","bold":true}'
            },
            {
              name: '震撼音效',
              enabled: true,
              command: '/playsound minecraft:entity.warden.emerge master @a ~ ~ ~ 1.0 0.8'
            },
            {
              name: '粒子效果',
              enabled: true,
              command: '/execute at @a run particle minecraft:sculk_soul ~ ~1 ~ 2 2 2 0.1 50'
            }
          ]
        }
      ],
      eventBridge: {
        port: 9696,
        host: '0.0.0.0',
        authToken: null
      },
      webServer: {
        port: 3000
      }
    };
    
    Object.assign(config, defaultConfig);
    
    const configContent = `// 配置文件
module.exports = ${JSON.stringify(config, null, 2)};`;
    
    fs.writeFileSync(path.join(__dirname, 'config.js'), configContent, 'utf8');
    
    res.json({ success: true, message: '配置已重置为默认值' });
  } catch (error) {
    res.status(500).json({ success: false, message: '重置配置失败: ' + error.message });
  }
});

// 启动系统
app.post('/api/start', async (req, res) => {
  try {
    await startApp();
    // 启动弹幕监听器（包含RCON连接）
    await danmuListener.start();
    res.json({ success: true, message: '系统启动成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 停止系统
app.post('/api/stop', (req, res) => {
  try {
    // 停止弹幕监听并断开RCON连接
    danmuListener.stop(true);
    res.json({ success: true, message: '系统已停止' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 配置Event Bridge认证令牌
app.post('/api/config/auth-token', (req, res) => {
  const { token } = req.body;
  
  eventBridgeServer.updateAuthToken(token || null);
  res.json({ success: true, message: '认证令牌已更新' });
});

// 重置计数器
app.post('/api/reset-counter', (req, res) => {
  danmuListener.resetCounter();
  res.json({ success: true, message: '计数器已重置' });
});

// 测试RCON连接
app.post('/api/test-rcon', async (req, res) => {
  try {
    // 确保RCON连接
    if (!rconClient.isConnected) {
      await rconClient.connect();
    }
    const result = await rconClient.sendCommand('/time query daytime');
    res.json({ success: true, message: 'RCON连接正常', result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 手动触发怪物生成（用于测试）
app.post('/api/test-spawn/:ruleIndex', async (req, res) => {
  try {
    // 确保RCON连接
    if (!rconClient.isConnected) {
      await rconClient.connect();
    }
    const ruleIndex = parseInt(req.params.ruleIndex);
    await danmuListener.testTrigger(ruleIndex);
    res.json({ success: true, message: '测试触发成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 模拟弹幕（用于测试）
app.post('/api/simulate-danmu', (req, res) => {
  const { message = config.triggerMessage, username = '测试用户' } = req.body;
  danmuListener.simulateMessage(message, username);
  res.json({ success: true, message: '模拟弹幕已处理' });
});

// 测试弹幕
app.post('/test', (req, res) => {
  danmuListener.simulateMessage(config.triggerMessage, '测试用户');
  res.json({ message: '测试弹幕已发送' });
});

// 测试SuperChat
app.post('/test-superchat', async (req, res) => {
  try {
    // 确保RCON连接
    if (!rconClient.isConnected) {
      await rconClient.connect();
    }
    await danmuListener.testSuperChat();
    res.json({ message: '测试SuperChat已发送到MC' });
  } catch (error) {
    res.status(500).json({ message: '测试失败: ' + error.message });
  }
});

// 测试舰长开通
app.post('/test-guard', async (req, res) => {
  try {
    // 确保RCON连接
    if (!rconClient.isConnected) {
      await rconClient.connect();
    }
    await danmuListener.testGuardPurchase();
    res.json({ message: '测试舰长开通已发送到MC' });
  } catch (error) {
    res.status(500).json({ message: '测试失败: ' + error.message });
  }
});

// 测试特定等级舰长开通
app.post('/test-guard/:level', async (req, res) => {
  try {
    // 确保RCON连接
    if (!rconClient.isConnected) {
      await rconClient.connect();
    }
    
    const level = parseInt(req.params.level);
    if (level < 1 || level > 3) {
      return res.status(400).json({ message: '舰长等级必须在1-3之间 (1=总督, 2=提督, 3=舰长)' });
    }
    
    const levelNames = { 1: '总督', 2: '提督', 3: '舰长' };
    await danmuListener.testGuardPurchaseByLevel(level);
    res.json({ message: `测试${levelNames[level]}开通已发送到MC` });
  } catch (error) {
    res.status(500).json({ message: '测试失败: ' + error.message });
  }
});

// 切换SuperChat监听
app.post('/toggle-superchat', (req, res) => {
  try {
    const enabled = danmuListener.toggleSuperChatListener();
    res.json({ 
      message: `SuperChat监听已${enabled ? '启用' : '关闭'}`,
      enabled: enabled
    });
  } catch (error) {
    res.status(500).json({ message: '切换失败: ' + error.message });
  }
});

// 切换舰长监听
app.post('/toggle-guard', (req, res) => {
  try {
    const enabled = danmuListener.toggleGuardListener();
    res.json({ 
      message: `舰长监听已${enabled ? '启用' : '关闭'}`,
      enabled: enabled
    });
  } catch (error) {
    res.status(500).json({ message: '切换失败: ' + error.message });
  }
});

// 首页路由
app.get('/', (req, res) => {
  const status = danmuListener.getStatus();
  const rconStatus = rconClient.isConnected;
  const specialEvents = danmuListener.getSpecialEventStatus();
  
  // 构建事件状态显示
  let countersHTML = '';
  if (status.counters) {
    Object.keys(status.counters).forEach(eventKey => {
      const counter = status.counters[eventKey];
      const eventIndex = eventKey.replace('event_', '') - 1;
      const percentage = Math.min((counter.count / counter.required) * 100, 100);
      countersHTML += `
        <div class="counter-card">
          <div class="counter-header">
            <h4>${counter.name}</h4>
            <span class="trigger-badge">${counter.triggeredTimes}次</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%"></div>
              <span class="progress-text">${counter.progress}</span>
            </div>
          </div>
          <div class="counter-actions">
            <button onclick="triggerEvent(${eventIndex})" class="trigger-btn">手动触发</button>
            <button onclick="resetEventCounter('${eventKey}')" class="reset-btn">重置</button>
          </div>
        </div>
      `;
    });
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <title>B站弹幕 -> MC RCON 控制台</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
      <meta name="googlebot" content="noindex, nofollow">
      <meta name="bingbot" content="noindex, nofollow">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --primary-color: #2563eb;
          --primary-hover: #1d4ed8;
          --success-color: #10b981;
          --success-hover: #059669;
          --warning-color: #f59e0b;
          --warning-hover: #d97706;
          --danger-color: #ef4444;
          --danger-hover: #dc2626;
          --secondary-color: #6b7280;
          --secondary-hover: #4b5563;
          
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-tertiary: #f1f5f9;
          --bg-accent: #eff6ff;
          
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #64748b;
          
          --border-light: #e2e8f0;
          --border-medium: #cbd5e1;
          
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          
          --radius-sm: 6px;
          --radius-md: 8px;
          --radius-lg: 12px;
          --radius-xl: 16px;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif; 
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
        }
        
        .container { 
          max-width: 1400px; 
          margin: 0 auto; 
          padding: 24px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 32px;
          padding: 32px 24px;
          background: linear-gradient(135deg, var(--primary-color) 0%, #3b82f6 100%);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          color: white;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          pointer-events: none;
        }
        
        .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }
        
        .header p {
          font-size: 1.1rem;
          opacity: 0.9;
          position: relative;
          z-index: 1;
        }
        
        .dashboard {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .main-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .card { 
          background: var(--bg-primary); 
          border-radius: var(--radius-lg); 
          padding: 24px; 
          box-shadow: var(--shadow-md);
          border: 1px solid var(--border-light);
          transition: all 0.2s ease;
        }
        
        .card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-2px);
        }
        
        .card h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
        }
        
        .status-card { 
          padding: 20px; 
          border-radius: var(--radius-md); 
          border-left: 4px solid var(--border-medium);
          background: var(--bg-secondary);
          transition: all 0.2s ease;
        }
        
        .status-card:hover {
          transform: translateX(4px);
        }
        
        .status-card.connected { 
          border-left-color: var(--success-color); 
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); 
        }
        .status-card.disconnected { 
          border-left-color: var(--danger-color); 
          background: linear-gradient(135deg, #fef2f2 0%, #fefefe 100%); 
        }
        .status-card.active { 
          border-left-color: var(--success-color); 
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); 
        }
        .status-card.inactive { 
          border-left-color: var(--warning-color); 
          background: linear-gradient(135deg, #fffbeb 0%, #fefce8 100%); 
        }
        
        .status-card h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-primary);
        }
        
        .status-card p {
          margin: 6px 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        
        .counters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .counter-card { 
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          border-radius: var(--radius-md);
          padding: 20px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        
        .counter-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        
        .counter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .counter-header h4 { 
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .trigger-badge {
          background: linear-gradient(135deg, var(--primary-color) 0%, #3b82f6 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }
        
        .progress-container {
          margin: 16px 0;
        }
        
        .progress-bar { 
          position: relative; 
          height: 28px; 
          background: var(--bg-tertiary); 
          border-radius: 14px; 
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .progress-fill { 
          height: 100%; 
          background: linear-gradient(90deg, var(--success-color) 0%, #34d399 100%); 
          border-radius: 14px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        }
        
        .progress-text { 
          position: absolute; 
          top: 50%; 
          left: 50%; 
          transform: translate(-50%, -50%); 
          color: var(--text-primary); 
          font-weight: 600; 
          font-size: 0.9rem;
          z-index: 1;
          text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
        }
        
        .counter-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        
        .btn { 
          padding: 10px 16px; 
          border: none; 
          border-radius: var(--radius-md); 
          cursor: pointer; 
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
        }
        
        .btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }
        
        .btn:hover::before {
          left: 100%;
        }
        
        .btn:hover { 
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        
        .btn:active {
          transform: translateY(0);
        }
        
        .btn-primary { 
          background: linear-gradient(135deg, var(--primary-color) 0%, #3b82f6 100%); 
          color: white; 
        }
        .btn-success { 
          background: linear-gradient(135deg, var(--success-color) 0%, #34d399 100%); 
          color: white; 
        }
        .btn-warning { 
          background: linear-gradient(135deg, var(--warning-color) 0%, #fbbf24 100%); 
          color: white; 
        }
        .btn-danger { 
          background: linear-gradient(135deg, var(--danger-color) 0%, #f87171 100%); 
          color: white; 
        }
        .btn-secondary { 
          background: linear-gradient(135deg, var(--secondary-color) 0%, #9ca3af 100%); 
          color: white; 
        }
        
        .trigger-btn { 
          background: linear-gradient(135deg, var(--danger-color) 0%, #f87171 100%); 
          color: white; 
          padding: 8px 16px; 
          font-size: 0.85rem;
          border-radius: var(--radius-md);
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
          font-weight: 600;
        }
        
        .trigger-btn:hover {
          background: linear-gradient(135deg, var(--danger-hover) 0%, #ef4444 100%);
          transform: translateY(-1px);
        }
        
        .reset-btn { 
          background: linear-gradient(135deg, var(--secondary-color) 0%, #9ca3af 100%); 
          color: white; 
          padding: 8px 16px; 
          font-size: 0.85rem;
          border-radius: var(--radius-md);
          border: none;
          cursor: pointer;
          flex: 1;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .reset-btn:hover {
          background: linear-gradient(135deg, var(--secondary-hover) 0%, #6b7280 100%);
          transform: translateY(-1px);
        }
        
        .special-events-section { 
          background: linear-gradient(135deg, var(--bg-accent) 0%, #dbeafe 100%);
          border-radius: var(--radius-lg);
          padding: 24px;
          border: 1px solid #bfdbfe;
          box-shadow: var(--shadow-md);
        }
        
        .special-events-section h3 {
          color: var(--primary-color);
          margin-bottom: 20px;
        }
        
        .events-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        .event-card {
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: 20px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        
        .event-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        
        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .event-card h4 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .toggle-switch,
        .toggle-switch-guard {
          position: relative;
          width: 52px;
          height: 28px;
          background: var(--danger-color);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
        }
        
        .toggle-switch[data-enabled="true"],
        .toggle-switch-guard[data-enabled="true"] {
          background: var(--success-color);
        }
        
        .toggle-switch:before,
        .toggle-switch-guard:before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .toggle-switch[data-enabled="true"]:before,
        .toggle-switch-guard[data-enabled="true"]:before {
          left: 26px;
        }
        
        .event-actions {
          margin-top: 16px;
          display: flex;
          gap: 12px;
        }
        
        .test-btn {
          background: linear-gradient(135deg, var(--secondary-color) 0%, #9ca3af 100%);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .test-btn:hover {
          background: linear-gradient(135deg, var(--secondary-hover) 0%, #6b7280 100%);
          transform: translateY(-1px);
        }
        
        .controls-section {
          text-align: center;
        }
        
        .control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        
        .log-section { 
          background: var(--bg-primary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-md);
        }
        
        .log-header {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          padding: 16px 20px;
          color: #f1f5f9;
          font-weight: 600;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        }
        
        .log-box { 
          height: 350px; 
          overflow-y: auto; 
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
          color: #e2e8f0; 
          padding: 20px; 
          font-family: 'Monaco', 'Menlo', 'JetBrains Mono', 'Ubuntu Mono', 'Consolas', monospace; 
          font-size: 0.85rem;
          line-height: 1.6;
          white-space: pre-wrap;
          position: relative;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }
        
        .log-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 1.6em,
            rgba(100, 116, 139, 0.05) 1.6em,
            rgba(100, 116, 139, 0.05) calc(1.6em + 1px)
          );
          pointer-events: none;
        }
        
        .log-box::-webkit-scrollbar {
          width: 12px;
        }
        
        .log-box::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 6px;
        }
        
        .log-box::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #475569 0%, #64748b 100%);
          border-radius: 6px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        
        .log-box::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
          background-clip: content-box;
        }
        
        .add-rule-btn {
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 0.9rem;
          cursor: pointer;
          width: 100%;
        }
        
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e1e5e9;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        @media (max-width: 768px) {
          .modal-content {
            width: 95%;
            margin: 2% auto;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 1024px) {
          .dashboard {
            grid-template-columns: 1fr;
          }
          
          .events-grid {
            grid-template-columns: 1fr;
          }
          
          .status-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 12px;
          }
          
          .header h1 {
            font-size: 1.5rem;
          }
          
          .counters-grid {
            grid-template-columns: 1fr;
          }
        }
        
        /* 变量提示样式 */
        .variable-help {
          cursor: help;
          color: var(--primary-color);
          margin: 0 4px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
          border: 1px solid transparent;
          font-weight: 500;
          position: relative;
          display: inline-block;
        }
        
        .variable-help:hover {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        /* 自定义Tooltip样式 */
        .custom-tooltip {
          position: relative;
          display: inline-block;
        }

        .custom-tooltip .tooltip-content {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: #f1f5f9;
          text-align: center;
          border-radius: 8px;
          padding: 12px 16px;
          z-index: 1001;
          font-size: 0.85rem;
          font-weight: 500;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(8px);
          white-space: nowrap;
          max-width: 300px;
          line-height: 1.4;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }

        .custom-tooltip .tooltip-content::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -6px;
          border-width: 6px;
          border-style: solid;
          border-color: #334155 transparent transparent transparent;
        }

        .custom-tooltip:hover .tooltip-content {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(-4px);
        }

        /* 变量标签美化 */
        .variable-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          margin: 2px;
          background: linear-gradient(135deg, var(--primary-color) 0%, #3b82f6 100%);
          color: white;
          border-radius: 16px;
          font-size: 0.8rem;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
          transition: all 0.2s ease;
          cursor: help;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .variable-tag:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
          background: linear-gradient(135deg, #1d4ed8 0%, var(--primary-color) 100%);
        }

        .variable-tag .var-icon {
          font-size: 0.7rem;
          opacity: 0.8;
        }

        /* 变量说明区域样式 */
        .variables-info {
          margin-top: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #fff3cd 0%, #fef7e0 100%);
          border-radius: var(--radius-md);
          border: 1px solid #fbbf24;
          box-shadow: var(--shadow-sm);
        }

        .variables-info h5 {
          margin: 0 0 12px 0;
          color: #d97706;
          font-size: 0.9rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .variables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 8px;
          margin-top: 8px;
        }
        
        /* 通知动画 */
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        
        /* 模态框样式 */
        .modal {
          display: none;
          position: fixed;
          z-index: 2000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          overflow-y: auto;
        }
        
        .modal-content {
          background: var(--bg-primary);
          margin: 20px auto;
          padding: 0;
          border-radius: var(--radius-xl);
          width: 90%;
          max-width: 900px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border-light);
          position: relative;
        }
        
        .modal-header {
          padding: 24px 28px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }
        
        .modal-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.4rem;
          font-weight: 600;
        }
        
        .close {
          color: var(--text-muted);
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
          background: none;
          border: none;
          transition: all 0.2s ease;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close:hover {
          color: var(--danger-color);
          background: var(--bg-tertiary);
          transform: scale(1.1);
        }
        
        .modal-body {
          padding: 28px;
        }
        
        .config-group {
          margin-bottom: 28px;
          padding: 20px;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          background: var(--bg-secondary);
        }
        
        .config-group h4 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
        }
        
        .form-group label {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 6px;
          font-weight: 600;
        }
        
        .form-group input,
        .form-group textarea {
          padding: 12px 16px;
          border: 1px solid var(--border-medium);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          transition: all 0.2s ease;
          background: var(--bg-primary);
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .command-rule {
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .command-rule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .remove-rule-btn {
          background: var(--danger-color);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          font-size: 0.8rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .remove-rule-btn:hover {
          background: var(--danger-hover);
          transform: translateY(-1px);
        }
        
        .add-rule-btn {
          background: var(--success-color);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          padding: 12px 20px;
          font-size: 0.9rem;
          cursor: pointer;
          width: 100%;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .add-rule-btn:hover {
          background: var(--success-hover);
          transform: translateY(-1px);
        }
        
        .modal-footer {
          padding: 20px 28px;
          border-top: 1px solid var(--border-light);
          display: flex;
          gap: 16px;
          justify-content: flex-end;
          background: var(--bg-secondary);
          border-radius: 0 0 var(--radius-xl) var(--radius-xl);
        }
        
        .stats-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          border-radius: var(--radius-md);
          padding: 20px;
          text-align: center;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        
        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary-color);
          margin-bottom: 8px;
          background: linear-gradient(135deg, var(--primary-color) 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎮 B站弹幕 → MC RCON 控制台</h1>
          <p>实时弹幕监听 • 智能事件触发 • 游戏增强体验</p>
        </div>
        
        <div class="dashboard">
          <div class="main-panel">
            <!-- 系统状态 -->
            <div class="card">
              <h3>📊 系统状态</h3>
              <div class="status-grid">
                <div class="status-card ${rconStatus ? 'connected' : 'disconnected'}">
                  <h3>🔌 RCON连接</h3>
                  <p><strong>状态:</strong> ${rconStatus ? '✅ 已连接' : '❌ 未连接'}</p>
                  <p><strong>服务器:</strong> ${config.rcon.host}:${config.rcon.port}</p>
                </div>
                
                <div class="status-card ${status.isActive ? 'active' : 'inactive'}">
                  <h3>👂 弹幕监听</h3>
                  <p><strong>状态:</strong> ${status.isActive ? '✅ 活跃监听' : '⏸️ 暂停中'}</p>
                  <p><strong>触发词:</strong> "${status.triggerMessage}"</p>
                </div>
              </div>
            </div>

            <!-- 事件计数器 -->
            <div class="card">
              <h3>🎯 事件计数器</h3>
              <div class="counters-grid">
                ${countersHTML || '<p style="text-align: center; color: #6c757d; margin: 20px 0;">暂无活动数据</p>'}
              </div>
            </div>

            <!-- 控制操作 -->
            <div class="card controls-section">
              <h3>🎛️ 系统控制</h3>
              <div class="control-grid">
                <button class="btn btn-success" onclick="startListener()">
                  <span>🟢</span> 启动监听
                </button>
                <button class="btn btn-warning" onclick="stopListener()">
                  <span>⏸️</span> 暂停监听  
                </button>
                <button class="btn btn-danger" onclick="resetAllCounters()">
                  <span>🔄</span> 重置计数器
                </button>
                <button class="btn btn-primary" onclick="testMessage()">
                  <span>🧪</span> 测试弹幕
                </button>
              </div>
            </div>
          </div>
          
          <div class="sidebar">
            <!-- 特殊事件监听 -->
            <div class="special-events-section">
              <h3>✨ 特殊事件监听</h3>
              <div class="events-grid">
                <div class="event-card">
                  <div class="event-header">
                    <h4>💰 SuperChat</h4>
                    <div class="toggle-switch" onclick="toggleSuperChat()" id="sc-toggle" data-enabled="${specialEvents.superChatEnabled}"></div>
                  </div>
                  <div class="event-actions">
                    <button onclick="testSuperChat()" class="test-btn">测试SC</button>
                  </div>
                </div>
                
                <div class="event-card">
                  <div class="event-header">
                    <h4>⚓ 舰长监听</h4>
                    <div class="toggle-switch-guard" onclick="toggleGuardPurchase()" id="guard-toggle" data-enabled="${specialEvents.guardPurchaseEnabled}"></div>
                  </div>
                  <div class="event-actions">
                    <button onclick="testGuardPurchase(3)" class="test-btn">🚢 舰长</button>
                    <button onclick="testGuardPurchase(2)" class="test-btn">⚓ 提督</button>
                    <button onclick="testGuardPurchase(1)" class="test-btn">👑 总督</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 配置管理 -->
            <div class="card">
              <h3>⚙️ 系统配置</h3>
              <div class="config-section">
                <button class="btn btn-primary" onclick="openConfigModal()" style="width: 100%; margin-bottom: 12px;">
                  📝 编辑配置
                </button>
                <button class="btn btn-secondary" onclick="resetConfig()" style="width: 100%;">
                  🔄 重置默认
                </button>
              </div>
            </div>

            <!-- 统计信息 -->
            <div class="card">
              <h3>📈 统计概览</h3>
              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-number">${status.totalKeywordCount || 0}</div>
                  <div class="stat-label">总累计次数</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${Object.values(status.counters || {}).reduce((sum, counter) => sum + counter.count, 0)}</div>
                  <div class="stat-label">当前累计</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 系统日志 -->
        <div class="card log-section">
          <div class="log-header">
            <span>📝 系统日志</span>
            <span style="float: right; font-size: 0.9rem; opacity: 0.8;">实时更新中...</span>
          </div>
          <div class="log-box" id="logBox">正在加载日志...</div>
        </div>
      </div>

      <!-- 配置管理模态框 -->
      <div id="configModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>⚙️ 系统配置管理</h3>
            <button class="close" onclick="closeConfigModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="configForm">
              <!-- RCON配置 -->
              <div class="config-group">
                <h4>🔌 RCON连接配置</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="rcon-host">服务器地址</label>
                    <input type="text" id="rcon-host" name="rcon.host" required>
                  </div>
                  <div class="form-group">
                    <label for="rcon-port">端口</label>
                    <input type="number" id="rcon-port" name="rcon.port" required min="1" max="65535">
                  </div>
                </div>
                <div class="form-group">
                  <label for="rcon-password">RCON密码</label>
                  <input type="password" id="rcon-password" name="rcon.password" required>
                </div>
              </div>

              <!-- 基本设置 -->
              <div class="config-group">
                <h4>🎯 基本设置</h4>
                <div class="form-group">
                  <label for="trigger-message">触发关键词</label>
                  <input type="text" id="trigger-message" name="triggerMessage" required>
                </div>
              </div>

              <!-- Event Bridge配置 -->
              <div class="config-group">
                <h4>🌉 Event Bridge配置</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="bridge-port">WebSocket端口</label>
                    <input type="number" id="bridge-port" name="eventBridge.port" required min="1" max="65535">
                  </div>
                  <div class="form-group">
                    <label for="bridge-host">监听地址</label>
                    <input type="text" id="bridge-host" name="eventBridge.host" required>
                  </div>
                </div>
                <div class="form-group">
                  <label for="auth-token">认证令牌 (可选)</label>
                  <input type="text" id="auth-token" name="eventBridge.authToken" placeholder="留空表示无需认证">
                </div>
              </div>

              <!-- 命令规则配置 -->
              <div class="config-group">
                <h4>⚡ 弹幕触发命令规则</h4>
                <div id="command-rules-container">
                  <!-- 动态生成命令规则 -->
                </div>
                <button type="button" class="add-rule-btn" onclick="addCommandRule()">
                  ➕ 添加新规则
                </button>
              </div>

              <!-- SuperChat事件配置 -->
              <div class="config-group">
                <h4>💰 SuperChat事件配置</h4>
                <div id="superchat-commands-container">
                  <!-- 动态生成SuperChat命令 -->
                </div>
                <button type="button" class="add-rule-btn" onclick="addSuperChatCommand()">
                  ➕ 添加SuperChat命令
                </button>
                <div class="variables-info">
                  <h5>
                    <span>🔧</span>
                    可用变量说明
                  </h5>
                  <div class="variables-grid">
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">👤</span>
                      {username}
                      <div class="tooltip-content">发送SuperChat的用户名称</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">💰</span>
                      {price}
                      <div class="tooltip-content">SuperChat的金额（人民币）</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">💬</span>
                      {message}
                      <div class="tooltip-content">SuperChat的消息内容</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">⚓</span>
                      {guardText}
                      <div class="tooltip-content">用户的舰长等级标识（如[舰长]）</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 舰长事件配置 -->
              <div class="config-group">
                <h4>⚓ 舰长开通事件配置</h4>
                <div id="guard-commands-container">
                  <!-- 动态生成舰长命令 -->
                </div>
                <button type="button" class="add-rule-btn" onclick="addGuardCommand()">
                  ➕ 添加舰长命令
                </button>
                <div class="variables-info">
                  <h5>
                    <span>🔧</span>
                    可用变量说明
                  </h5>
                  <div class="variables-grid">
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">👤</span>
                      {username}
                      <div class="tooltip-content">开通舰长的用户名称</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">💰</span>
                      {price}
                      <div class="tooltip-content">开通舰长的价格（人民币）</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">⚓</span>
                      {guardText}
                      <div class="tooltip-content">舰长等级标识（如[舰长]）</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">👑</span>
                      {guardIcon}
                      <div class="tooltip-content">舰长图标（👑总督/⚓提督/🚢舰长）</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">🎨</span>
                      {guardColor}
                      <div class="tooltip-content">舰长颜色（light_purple/blue/aqua）</div>
                    </div>
                    <div class="custom-tooltip variable-tag">
                      <span class="var-icon">🏷️</span>
                      {guardType}
                      <div class="tooltip-content">舰长类型名称（总督/提督/舰长）</div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeConfigModal()">取消</button>
            <button type="button" class="btn btn-primary" onclick="saveConfig()">保存配置</button>
          </div>
        </div>
      </div>

      <script>
        function startListener() {
          fetch('/start', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'success');
              updateRealTimeStats();
            })
            .catch(err => showNotification('操作失败', 'error'));
        }

        function stopListener() {
          fetch('/stop', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'warning');
              updateRealTimeStats();
            })
            .catch(err => showNotification('操作失败', 'error'));
        }

        function resetAllCounters() {
          if (confirm('确定要重置所有计数器吗？')) {
            fetch('/reset', {method: 'POST'})
              .then(response => response.json())
              .then(data => {
                showNotification(data.message, 'info');
                updateRealTimeStats();
              })
              .catch(err => showNotification('操作失败', 'error'));
          }
        }

        function resetEventCounter(eventKey) {
          const eventIndex = eventKey.replace('event_', '') - 1;
          fetch('/reset-event', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({eventIndex})
          })
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'info');
              updateRealTimeStats();
            })
            .catch(err => showNotification('操作失败', 'error'));
        }

        function testMessage() {
          fetch('/test', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'info');
              updateRealTimeStats();
            })
            .catch(err => showNotification('测试失败', 'error'));
        }

        function testSuperChat() {
          fetch('/test-superchat', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'success');
            })
            .catch(err => showNotification('测试失败', 'error'));
        }

        function testGuardPurchase(level = null) {
          const levelNames = { 1: '总督', 2: '提督', 3: '舰长' };
          
          if (level && level >= 1 && level <= 3) {
            // 测试特定等级
            fetch(\`/test-guard/\${level}\`, {method: 'POST'})
              .then(response => response.json())
              .then(data => {
                showNotification(data.message, 'success');
              })
              .catch(err => showNotification(\`测试\${levelNames[level]}失败\`, 'error'));
          } else {
            // 默认测试舰长
          fetch('/test-guard', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'success');
            })
            .catch(err => showNotification('测试失败', 'error'));
          }
        }

        function toggleSuperChat() {
          fetch('/toggle-superchat', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'info');
              updateSpecialEventToggles(data.enabled, 'superchat');
            })
            .catch(err => showNotification('切换失败', 'error'));
        }

        function toggleGuardPurchase() {
          fetch('/toggle-guard', {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(data.message, 'info');
              updateSpecialEventToggles(data.enabled, 'guard');
            })
            .catch(err => showNotification('切换失败', 'error'));
        }

        // 动态更新开关状态
        function updateSpecialEventToggles(enabled, type) {
          const toggleElement = document.getElementById(type === 'superchat' ? 'sc-toggle' : 'guard-toggle');
          if (toggleElement) {
            toggleElement.setAttribute('data-enabled', enabled);
          }
        }

        // 通知系统
        let notificationCount = 0;
        const MAX_NOTIFICATIONS = 5;
        
        function showNotification(message, type = 'info') {
          // 检查并移除超出限制的通知
          const existingNotifications = document.querySelectorAll('.notification');
          if (existingNotifications.length >= MAX_NOTIFICATIONS) {
            // 移除最旧的通知
            existingNotifications[0].remove();
          }
          
          const notification = document.createElement('div');
          notification.className = 'notification';
          notification.style.cssText = \`
            position: fixed;
            top: \${20 + (existingNotifications.length * 60)}px;
            right: 20px;
            padding: 14px 18px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            background: \${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' : 
                        type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' : 
                        type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' : 
                        'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)'};
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            max-width: 320px;
            word-wrap: break-word;
            font-size: 0.9rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
          \`;
          notification.textContent = message;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
              if (notification.parentNode) {
                notification.remove();
                // 重新计算其他通知的位置
                repositionNotifications();
              }
            }, 300);
          }, 3000);
        }
        
        function repositionNotifications() {
          const notifications = document.querySelectorAll('.notification');
          notifications.forEach((notification, index) => {
            notification.style.top = \`\${20 + (index * 60)}px\`;
          });
        }

        function triggerEvent(eventIndex) {
          fetch(\`/api/test-spawn/\${eventIndex}\`, {method: 'POST'})
            .then(response => response.json())
            .then(data => {
              showNotification(\`事件\${eventIndex + 1}已手动触发\`, 'success');
              updateRealTimeStats();
            })
            .catch(err => showNotification('触发失败', 'error'));
        }

        // 实时更新统计数据
        function updateRealTimeStats() {
          fetch('/api/status')
            .then(response => response.json())
            .then(data => {
              // 更新计数器进度条
              const counters = data.danmu.counters || {};
              Object.keys(counters).forEach(eventKey => {
                const counter = counters[eventKey];
                const eventIndex = eventKey.replace('event_', '') - 1;
                const percentage = Math.min((counter.count / counter.required) * 100, 100);
                
                // 更新进度条
                const progressFill = document.querySelector(\`.counter-card:nth-child(\${eventIndex + 1}) .progress-fill\`);
                const progressText = document.querySelector(\`.counter-card:nth-child(\${eventIndex + 1}) .progress-text\`);
                const triggerBadge = document.querySelector(\`.counter-card:nth-child(\${eventIndex + 1}) .trigger-badge\`);
                
                if (progressFill) progressFill.style.width = \`\${percentage}%\`;
                if (progressText) progressText.textContent = counter.progress;
                if (triggerBadge) triggerBadge.textContent = \`\${counter.triggeredTimes}次\`;
              });
              
              // 更新统计概览
              const totalKeywords = data.danmu.totalKeywordCount || 0;
              const totalCurrent = Object.values(counters).reduce((sum, counter) => sum + counter.count, 0);
              
              const totalKeywordsElement = document.querySelector('.stat-card:nth-child(1) .stat-number');
              const totalCurrentElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
              
              if (totalKeywordsElement) totalKeywordsElement.textContent = totalKeywords;
              if (totalCurrentElement) totalCurrentElement.textContent = totalCurrent;
              
              // 更新连接状态指示器
              const rconCard = document.querySelector('.status-card:nth-child(1)');
              const danmuCard = document.querySelector('.status-card:nth-child(2)');
              
              if (rconCard) {
                rconCard.className = \`status-card \${data.rcon.connected ? 'connected' : 'disconnected'}\`;
                const statusP = rconCard.querySelector('p:nth-child(2)');
                if (statusP) statusP.innerHTML = \`<strong>状态:</strong> \${data.rcon.connected ? '✅ 已连接' : '❌ 未连接'}\`;
              }
              
              if (danmuCard) {
                danmuCard.className = \`status-card \${data.danmu.isActive ? 'active' : 'inactive'}\`;
                const statusP = danmuCard.querySelector('p:nth-child(2)');
                if (statusP) statusP.innerHTML = \`<strong>状态:</strong> \${data.danmu.isActive ? '✅ 活跃监听' : '⏸️ 暂停中'}\`;
              }
            })
            .catch(err => console.error('更新统计数据失败:', err));
        }

        // 加载日志
        function updateLogs() {
          fetch('/api/logs')
            .then(response => response.json())
            .then(data => {
              const logBox = document.getElementById('logBox');
              if (logBox) {
                logBox.textContent = data.logs.join('\\n');
                logBox.scrollTop = logBox.scrollHeight;
              }
            })
            .catch(err => console.error('加载日志失败:', err));
        }

        // 初始化
        updateLogs();
        updateRealTimeStats();
        
        // 设置实时更新间隔
        setInterval(updateLogs, 2000);
        setInterval(updateRealTimeStats, 1000);

        // 配置管理函数
        let currentConfig = {};
        let hasUnsavedChanges = false;

        // 监听表单变化，提示用户有未保存的更改
        function markConfigAsChanged() {
          hasUnsavedChanges = true;
          updateSaveButtonState();
        }

        function markConfigAsSaved() {
          hasUnsavedChanges = false;
          updateSaveButtonState();
        }

        function updateSaveButtonState() {
          const saveButton = document.querySelector('.modal-footer .btn-primary');
          if (saveButton) {
            if (hasUnsavedChanges) {
              saveButton.textContent = '💾 保存配置 *';
              saveButton.style.background = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
            } else {
              saveButton.textContent = '💾 保存配置';
              saveButton.style.background = '';
            }
          }
        }

        function openConfigModal() {
          fetch('/api/config')
            .then(response => response.json())
            .then(config => {
              currentConfig = config;
              populateConfigForm(config);
              document.getElementById('configModal').style.display = 'block';
              
              // 重置未保存状态
              markConfigAsSaved();
              
              // 添加表单变化监听
              setTimeout(() => {
                const configForm = document.getElementById('configForm');
                if (configForm) {
                  configForm.addEventListener('input', markConfigAsChanged);
                  configForm.addEventListener('change', markConfigAsChanged);
                }
              }, 100);
            })
            .catch(err => showNotification('加载配置失败', 'error'));
        }

        function closeConfigModal() {
          if (hasUnsavedChanges) {
            if (!confirm('您有未保存的更改，确定要关闭吗？')) {
              return;
            }
          }
          
          document.getElementById('configModal').style.display = 'none';
          
          // 移除事件监听器
          const configForm = document.getElementById('configForm');
          if (configForm) {
            configForm.removeEventListener('input', markConfigAsChanged);
            configForm.removeEventListener('change', markConfigAsChanged);
          }
        }

        function populateConfigForm(config) {
          // 填充基本配置
          document.getElementById('rcon-host').value = config.rcon.host;
          document.getElementById('rcon-port').value = config.rcon.port;
          document.getElementById('rcon-password').value = config.rcon.password;
          document.getElementById('trigger-message').value = config.triggerMessage;
          document.getElementById('bridge-port').value = config.eventBridge.port;
          document.getElementById('bridge-host').value = config.eventBridge.host;
          document.getElementById('auth-token').value = config.eventBridge.authToken || '';

          // 填充命令规则
          renderCommandRules(config.commandRules);
          
          // 填充SuperChat命令
          renderSuperChatCommands(config.eventSettings.superChatCommands || []);
          
          // 填充舰长命令
          renderGuardCommands(config.eventSettings.guardCommands || []);
        }

        function renderCommandRules(rules) {
          const container = document.getElementById('command-rules-container');
          container.innerHTML = '';

          rules.forEach((rule, index) => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'command-rule';
            
            let commandsHTML = '';
            if (rule.commands && Array.isArray(rule.commands)) {
              rule.commands.forEach((cmd, cmdIndex) => {
                commandsHTML += \`
                  <div class="sub-command" style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #007bff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-weight: 500;">命令 \${cmdIndex + 1}</span>
                      <div>
                        <input type="checkbox" name="commandRules[\${index}].commands[\${cmdIndex}].enabled" \${cmd.enabled ? 'checked' : ''} style="margin-right: 8px;">
                        <button type="button" class="remove-rule-btn" onclick="removeSubCommand(\${index}, \${cmdIndex})" style="padding: 2px 6px; font-size: 0.7rem;">删除</button>
                      </div>
                    </div>
                    <div class="form-group">
                      <label>命令名称</label>
                      <input type="text" name="commandRules[\${index}].commands[\${cmdIndex}].name" value="\${cmd.name}" required>
                    </div>
                    <div class="form-group">
                      <label>命令内容</label>
                      <textarea name="commandRules[\${index}].commands[\${cmdIndex}].command" required>\${cmd.command}</textarea>
                    </div>
                  </div>
                \`;
              });
            }
            
            ruleDiv.innerHTML = \`
              <div class="command-rule-header">
                <span>规则 \${index + 1}: \${rule.name}</span>
                <div>
                  <input type="checkbox" name="commandRules[\${index}].enabled" \${rule.enabled !== false ? 'checked' : ''} style="margin-right: 8px;" title="启用/禁用此规则">
                  <button type="button" class="remove-rule-btn" onclick="removeCommandRule(\${index})">删除规则</button>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>规则名称</label>
                  <input type="text" name="commandRules[\${index}].name" value="\${rule.name}" required>
                </div>
                <div class="form-group">
                  <label>触发数量</label>
                  <input type="number" name="commandRules[\${index}].count" value="\${rule.count}" required min="1">
                </div>
              </div>
              <div style="margin-top: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <label style="font-weight: 600;">命令列表</label>
                  <button type="button" class="btn btn-primary" onclick="addSubCommand(\${index})" style="padding: 4px 8px; font-size: 0.8rem;">➕ 添加命令</button>
                </div>
                \${commandsHTML}
              </div>
            \`;
            container.appendChild(ruleDiv);
          });
        }

        function renderDanmuTriggerCommands(commands) {
          const container = document.getElementById('danmu-trigger-commands-container');
          container.innerHTML = '';

          commands.forEach((cmd, index) => {
            const cmdDiv = document.createElement('div');
            cmdDiv.className = 'command-rule';
            cmdDiv.innerHTML = \`
              <div class="command-rule-header">
                <span>\${cmd.name}</span>
                <div>
                  <input type="checkbox" name="danmuTriggerCommands[\${index}].enabled" \${cmd.enabled ? 'checked' : ''} style="margin-right: 8px;">
                  <button type="button" class="remove-rule-btn" onclick="removeDanmuTriggerCommand(\${index})">删除</button>
                </div>
              </div>
              <div class="form-group">
                <label>命令名称</label>
                <input type="text" name="danmuTriggerCommands[\${index}].name" value="\${cmd.name}" required>
              </div>
              <div class="form-group">
                <label>命令内容</label>
                <textarea name="danmuTriggerCommands[\${index}].command" required>\${cmd.command}</textarea>
              </div>
            \`;
            container.appendChild(cmdDiv);
          });
        }

        function renderSuperChatCommands(commands) {
          const container = document.getElementById('superchat-commands-container');
          container.innerHTML = '';

          commands.forEach((cmd, index) => {
            const cmdDiv = document.createElement('div');
            cmdDiv.className = 'command-rule';
            cmdDiv.innerHTML = \`
              <div class="command-rule-header">
                <span>\${cmd.name}</span>
                <div>
                  <input type="checkbox" name="superChatCommands[\${index}].enabled" \${cmd.enabled ? 'checked' : ''} style="margin-right: 8px;">
                  <button type="button" class="remove-rule-btn" onclick="removeSuperChatCommand(\${index})">删除</button>
                </div>
              </div>
              <div class="form-group">
                <label>命令名称</label>
                <input type="text" name="superChatCommands[\${index}].name" value="\${cmd.name}" required>
              </div>
              <div class="form-group">
                <label>命令内容</label>
                <textarea name="superChatCommands[\${index}].command" required>\${cmd.command}</textarea>
              </div>
            \`;
            container.appendChild(cmdDiv);
          });
        }

        function renderGuardCommands(commands) {
          const container = document.getElementById('guard-commands-container');
          container.innerHTML = '';

          commands.forEach((cmd, index) => {
            const cmdDiv = document.createElement('div');
            cmdDiv.className = 'command-rule';
            cmdDiv.innerHTML = \`
              <div class="command-rule-header">
                <span>\${cmd.name}</span>
                <div>
                  <input type="checkbox" name="guardCommands[\${index}].enabled" \${cmd.enabled ? 'checked' : ''} style="margin-right: 8px;">
                  <button type="button" class="remove-rule-btn" onclick="removeGuardCommand(\${index})">删除</button>
                </div>
              </div>
              <div class="form-group">
                <label>命令名称</label>
                <input type="text" name="guardCommands[\${index}].name" value="\${cmd.name}" required>
              </div>
              <div class="form-group">
                <label>命令内容</label>
                <textarea name="guardCommands[\${index}].command" required>\${cmd.command}</textarea>
              </div>
            \`;
            container.appendChild(cmdDiv);
          });
        }

        // 收集当前表单数据的函数
        function collectCurrentFormData() {
          const formData = new FormData(document.getElementById('configForm'));
          const config = {};
          
          // 收集RCON配置
          config.rcon = {
            host: formData.get('rcon.host') || currentConfig.rcon.host,
            port: parseInt(formData.get('rcon.port')) || currentConfig.rcon.port,
            password: formData.get('rcon.password') || currentConfig.rcon.password
          };

          // 收集基本设置
          config.triggerMessage = formData.get('triggerMessage') || currentConfig.triggerMessage;

          // 收集Event Bridge配置
          config.eventBridge = {
            port: parseInt(formData.get('eventBridge.port')) || currentConfig.eventBridge.port,
            host: formData.get('eventBridge.host') || currentConfig.eventBridge.host,
            authToken: formData.get('eventBridge.authToken') || currentConfig.eventBridge.authToken
          };

          // 收集事件设置（保持开关状态）
          config.eventSettings = {
            superChatEnabled: currentConfig.eventSettings.superChatEnabled,
            guardPurchaseEnabled: currentConfig.eventSettings.guardPurchaseEnabled,
            superChatCommands: [],
            guardCommands: []
          };

          // 收集SuperChat命令
          const superChatElements = document.querySelectorAll('#superchat-commands-container .command-rule');
          superChatElements.forEach((cmdEl, index) => {
            const nameInput = cmdEl.querySelector('input[name="superChatCommands[' + index + '].name"]');
            const commandInput = cmdEl.querySelector('textarea[name="superChatCommands[' + index + '].command"]');
            const enabledInput = cmdEl.querySelector('input[name="superChatCommands[' + index + '].enabled"]');

            if (nameInput && commandInput) {
              config.eventSettings.superChatCommands.push({
                name: nameInput.value,
                command: commandInput.value,
                enabled: enabledInput ? enabledInput.checked : true
              });
            }
          });

          // 收集舰长命令
          const guardElements = document.querySelectorAll('#guard-commands-container .command-rule');
          guardElements.forEach((cmdEl, index) => {
            const nameInput = cmdEl.querySelector('input[name="guardCommands[' + index + '].name"]');
            const commandInput = cmdEl.querySelector('textarea[name="guardCommands[' + index + '].command"]');
            const enabledInput = cmdEl.querySelector('input[name="guardCommands[' + index + '].enabled"]');

            if (nameInput && commandInput) {
              config.eventSettings.guardCommands.push({
                name: nameInput.value,
                command: commandInput.value,
                enabled: enabledInput ? enabledInput.checked : true
              });
            }
          });
          
          // 收集命令规则数据
          config.commandRules = [];
          const ruleElements = document.querySelectorAll('#command-rules-container .command-rule');
          ruleElements.forEach((ruleEl, index) => {
            const nameInput = ruleEl.querySelector('input[name="commandRules[' + index + '].name"]');
            const countInput = ruleEl.querySelector('input[name="commandRules[' + index + '].count"]');
            const enabledInput = ruleEl.querySelector('input[name="commandRules[' + index + '].enabled"]');

            if (nameInput && countInput) {
              const rule = {
                name: nameInput.value,
                count: parseInt(countInput.value),
                enabled: enabledInput ? enabledInput.checked : true,
                commands: []
              };

              // 收集该规则下的所有命令
              const commandElements = ruleEl.querySelectorAll('.sub-command');
              commandElements.forEach((cmdEl, cmdIndex) => {
                const cmdNameInput = cmdEl.querySelector('input[name="commandRules[' + index + '].commands[' + cmdIndex + '].name"]');
                const cmdCommandInput = cmdEl.querySelector('textarea[name="commandRules[' + index + '].commands[' + cmdIndex + '].command"]');
                const cmdEnabledInput = cmdEl.querySelector('input[name="commandRules[' + index + '].commands[' + cmdIndex + '].enabled"]');

                if (cmdNameInput && cmdCommandInput) {
                  rule.commands.push({
                    name: cmdNameInput.value,
                    command: cmdCommandInput.value,
                    enabled: cmdEnabledInput ? cmdEnabledInput.checked : true
                  });
                }
              });

              config.commandRules.push(rule);
            }
          });

          // 保留web服务器配置
          config.webServer = currentConfig.webServer;
          
          return config;
        }

        function addCommandRule() {
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          const newRule = {
            name: '新命令规则',
            count: 1,
            enabled: true,
            commands: [
              {
                name: '主要命令',
                enabled: true,
                command: '/tellraw @a {"text":"✨ 这是一个新命令！","color":"yellow"}'
              }
            ]
          };
          currentConfig.commandRules.push(newRule);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('✨ 新规则已添加，您的其他修改已保留', 'info');
        }

        function removeCommandRule(index) {
          if (currentConfig.commandRules.length <= 1) {
            showNotification('至少需要保留一个命令规则', 'warning');
            return;
          }
          
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          currentConfig.commandRules.splice(index, 1);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('🗑️ 规则已删除，您的其他修改已保留', 'info');
        }

        function addSubCommand(ruleIndex) {
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          const newCommand = {
            name: '新命令',
            enabled: true,
            command: '/tellraw @a {"text":"✨ 这是一个新命令！","color":"yellow"}'
          };
          
          if (!currentConfig.commandRules[ruleIndex].commands) {
            currentConfig.commandRules[ruleIndex].commands = [];
          }
          currentConfig.commandRules[ruleIndex].commands.push(newCommand);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('➕ 命令已添加，您的其他修改已保留', 'info');
        }

        function removeSubCommand(ruleIndex, commandIndex) {
          if (!currentConfig.commandRules[ruleIndex].commands || currentConfig.commandRules[ruleIndex].commands.length <= 1) {
            showNotification('每个规则至少需要保留一个命令', 'warning');
            return;
          }
          
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          currentConfig.commandRules[ruleIndex].commands.splice(commandIndex, 1);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('🗑️ 命令已删除，您的其他修改已保留', 'info');
        }

        function addDanmuTriggerCommand() {
          const newCommand = {
            name: '新触发命令',
            command: '/tellraw @a {"text":"🎯 弹幕触发！执行了 {eventName}！","color":"aqua"}',
            enabled: true
          };
          if (!currentConfig.eventSettings.danmuTriggerCommands) {
            currentConfig.eventSettings.danmuTriggerCommands = [];
          }
          currentConfig.eventSettings.danmuTriggerCommands.push(newCommand);
          renderDanmuTriggerCommands(currentConfig.eventSettings.danmuTriggerCommands);
        }

        function removeDanmuTriggerCommand(index) {
          if (!currentConfig.eventSettings.danmuTriggerCommands || currentConfig.eventSettings.danmuTriggerCommands.length <= 1) {
            showNotification('至少需要保留一个弹幕触发命令', 'warning');
            return;
          }
          currentConfig.eventSettings.danmuTriggerCommands.splice(index, 1);
          renderDanmuTriggerCommands(currentConfig.eventSettings.danmuTriggerCommands);
        }

        function addSuperChatCommand() {
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          const newCommand = {
            name: '新SuperChat命令',
            command: '/execute at @a[name="WittF"] run summon minecraft:zombie ~ ~ ~',
            enabled: true
          };
          currentConfig.eventSettings.superChatCommands.push(newCommand);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('💰 SuperChat命令已添加，您的其他修改已保留', 'info');
        }

        function removeSuperChatCommand(index) {
          if (currentConfig.eventSettings.superChatCommands.length <= 1) {
            showNotification('至少需要保留一个SuperChat命令', 'warning');
            return;
          }
          
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          currentConfig.eventSettings.superChatCommands.splice(index, 1);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('🗑️ SuperChat命令已删除，您的其他修改已保留', 'info');
        }

        function addGuardCommand() {
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          const newCommand = {
            name: '新舰长命令',
            command: '/execute at @a[name="WittF"] run summon minecraft:zombie ~ ~ ~',
            enabled: true
          };
          currentConfig.eventSettings.guardCommands.push(newCommand);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('⚓ 舰长命令已添加，您的其他修改已保留', 'info');
        }

        function removeGuardCommand(index) {
          if (currentConfig.eventSettings.guardCommands.length <= 1) {
            showNotification('至少需要保留一个舰长命令', 'warning');
            return;
          }
          
          // 先收集当前表单的所有数据
          const updatedConfig = collectCurrentFormData();
          
          // 完全更新currentConfig为当前表单数据
          Object.assign(currentConfig, updatedConfig);
          
          currentConfig.eventSettings.guardCommands.splice(index, 1);
          
          // 重新填充整个表单以保持所有修改
          populateConfigForm(currentConfig);
          
          // 重置保存状态，因为这只是界面操作
          setTimeout(() => {
            markConfigAsSaved();
          }, 50);
          
          // 提示用户修改已保留
          showNotification('🗑️ 舰长命令已删除，您的其他修改已保留', 'info');
        }

        function saveConfig() {
          // 使用改进的数据收集函数获取所有配置
          const config = collectCurrentFormData();

          // 发送配置更新请求
          fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
          })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                // 立即标记为已保存，避免关闭时误报
                markConfigAsSaved();
                
                // 检查是否为热更新
                if (data.hotReload) {
                  // 热更新成功
                  if (data.warnings && data.warnings.length > 0) {
                    showNotification('⚠️ ' + data.message, 'warning');
                  } else {
                    showNotification('🔥 ' + data.message, 'success');
                  }
                  
                  // 显示更新详情
                  if (data.updateResults) {
                    data.updateResults.forEach(result => {
                      const icon = result.success ? '✅' : '❌';
                      const type = result.success ? 'info' : 'warning';
                      showNotification(icon + ' ' + result.module + ': ' + (result.success ? '更新成功' : '更新失败'), type);
                    });
                  }
                  
                  // 延迟关闭模态框，确保状态更新完成
                  setTimeout(() => {
                    closeConfigModal();
                  }, 100);
                  
                  // 立即更新状态（无需等待重启）
                  updateRealTimeStats();
                } else {
                  // 传统重启模式
                  showNotification(data.message, 'success');
                  
                  // 延迟关闭模态框，确保状态更新完成
                  setTimeout(() => {
                    closeConfigModal();
                  }, 100);
                  
                  // 延迟更新状态，等待服务重启
                  setTimeout(() => {
                    updateRealTimeStats();
                  }, 2000);
                }
              } else {
                showNotification('❌ ' + data.message, 'error');
              }
            })
            .catch(err => {
              showNotification('❌ 保存配置失败', 'error');
            });
        }

        function resetConfig() {
          if (confirm('确定要重置所有配置为默认值吗？这将覆盖当前所有设置！')) {
            fetch('/api/config/reset', {method: 'POST'})
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  showNotification(data.message, 'success');
                  closeConfigModal();
                  setTimeout(() => {
                    location.reload(); // 重置后刷新页面
                  }, 1000);
                } else {
                  showNotification(data.message, 'error');
                }
              })
              .catch(err => showNotification('重置配置失败', 'error'));
          }
        }

        // 点击模态框外部关闭
        window.onclick = function(event) {
          const modal = document.getElementById('configModal');
          if (event.target === modal) {
            closeConfigModal();
          }
        };
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// 重置特定事件计数器的路由
app.post('/reset-event', (req, res) => {
  const { eventIndex } = req.body;
  danmuListener.resetEventCounter(eventIndex);
  res.json({ message: `事件${eventIndex + 1}计数器已重置` });
});

// 启动监听
app.post('/start', async (req, res) => {
  try {
    await danmuListener.start();
    res.json({ message: '弹幕监听已启动' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 停止监听
app.post('/stop', (req, res) => {
  try {
    danmuListener.stop(true);
    res.json({ message: '弹幕监听已停止' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/reset', (req, res) => {
  danmuListener.resetCounter();
  res.json({ message: '所有计数器已重置' });
});

// 启动Web服务器
const PORT = process.env.PORT || config.webServer.port;
app.listen(PORT, () => {
  console.log('=====================================');
  console.log('🎮 B站弹幕 -> MC RCON 系统');
  console.log('=====================================');
  console.log(`🌐 Web管理面板: http://localhost:${PORT}`);
  console.log(`📡 Event Bridge: ws://localhost:${config.eventBridge.port}`);
  console.log('📋 LAPLACE Chat配置: ws://localhost:9696');
  console.log('');
  console.log('⚠️  重要提示:');
  console.log('🔌 RCON连接将在启动弹幕监听时自动建立');
  console.log('⏸️  暂停监听时RCON连接会自动断开以节省资源');
  console.log('🧪 测试功能使用时会自动连接RCON');
  console.log('📝 所有终端日志都会被实时捕获并显示在Web界面中');
  console.log('🖥️  您可以在浏览器中查看完整的系统运行日志');
  console.log('🔄 日志每2秒自动更新，支持实时监控');
  console.log('');
  console.log('请在浏览器中打开管理面板进行配置和控制');
  console.log('=====================================');
  
  // 自动启动系统
  setTimeout(() => {
    startApp();
  }, 2000);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭系统...');
  danmuListener.stop();
  eventBridgeServer.stop();
  rconClient.disconnect();
  process.exit(0);
}); 