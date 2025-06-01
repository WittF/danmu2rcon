const { Rcon } = require('rcon-client');
const config = require('./config');

class RconClient {
  constructor() {
    this.rcon = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.reconnectDelay = 5000; // 5秒重连延迟
  }

  // 连接到RCON服务器
  async connect() {
    if (this.isConnected) {
      console.log('[RCON] 已连接到服务器');
      return Promise.resolve();
    }

    try {
      console.log(`[RCON] 正在连接到 ${config.rcon.host}:${config.rcon.port}...`);
      
      this.rcon = new Rcon({
        host: config.rcon.host,
        port: config.rcon.port,
        password: config.rcon.password,
        timeout: 5000
      });

      await this.rcon.connect();
      this.isConnected = true;
      this.retryCount = 0;
      console.log('[RCON] ✅ 连接认证成功');
      
    } catch (error) {
      console.error(`[RCON] ❌ 连接错误: ${error.message}`);
      this.isConnected = false;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`[RCON] 🔄 ${this.reconnectDelay/1000}秒后进行第${this.retryCount}次重连...`);
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        return this.connect();
      }
      
      throw error;
    }
  }

  // 断开连接
  async disconnect() {
    if (this.rcon && this.isConnected) {
      console.log('[RCON] 断开连接...');
      await this.rcon.end();
      this.isConnected = false;
    }
  }

  // 发送命令
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('RCON未连接，无法发送命令');
    }

    try {
      console.log(`[RCON] 发送命令: ${command}`);
      const response = await this.rcon.send(command);
      console.log(`[RCON] ✅ 命令执行成功`);
      
      if (response && response.trim() !== '') {
        console.log(`[RCON] 响应: ${response}`);
      }
      
      return response;
    } catch (error) {
      console.error(`[RCON] 命令执行失败: ${error.message}`);
      throw error;
    }
  }

  // 执行事件触发命令（支持多命令结构）
  async executeEventTrigger(rule, eventName) {
    if (!this.isConnected) {
      console.log('[RCON] 未连接，跳过命令执行');
      return false;
    }

    try {
      // 支持新的多命令结构
      if (rule.commands && Array.isArray(rule.commands)) {
        console.log(`[RCON] 开始执行 ${eventName} (${rule.commands.length}个命令)`);
        
        for (const cmdConfig of rule.commands) {
          if (cmdConfig.enabled !== false) { // 默认启用
            await this.sendCommand(cmdConfig.command);
            console.log(`[RCON] ✅ 已执行: ${cmdConfig.name}`);
            
            // 命令间稍作延迟，避免服务器压力
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            console.log(`[RCON] ⏭️ 跳过已禁用的命令: ${cmdConfig.name}`);
          }
        }
      } else if (rule.command) {
        // 兼容旧版单命令结构
        await this.sendCommand(rule.command);
      } else {
        console.log(`[RCON] ⚠️ 规则 ${eventName} 没有有效的命令配置`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[RCON] 执行 ${eventName} 时出错:`, error.message);
      return false;
    }
  }

  // 检查连接状态
  getStatus() {
    return {
      connected: this.isConnected,
      host: config.rcon.host,
      port: config.rcon.port,
      retryCount: this.retryCount
    };
  }

  // 诊断RCON连接问题
  async diagnoseConnection() {
    console.log('[RCON] 开始诊断连接问题...');
    console.log(`[RCON] 连接目标: ${config.rcon.host}:${config.rcon.port}`);
    console.log(`[RCON] 当前状态: ${this.isConnected ? '已连接' : '未连接'}`);
    
    if (!this.isConnected) {
      console.log('[RCON] ❌ RCON未连接，请检查：');
      console.log('[RCON]   1. Minecraft服务器是否运行');
      console.log('[RCON]   2. server.properties中enable-rcon=true');
      console.log('[RCON]   3. rcon.port=' + config.rcon.port);
      console.log('[RCON]   4. rcon.password与配置是否一致');
      console.log('[RCON]   5. 防火墙是否允许端口通信');
      return false;
    }
    
    try {
      // 测试简单命令
      console.log('[RCON] 测试基本命令...');
      await this.sendCommand('/list');
      console.log('[RCON] ✅ 基本命令测试通过');
      return true;
    } catch (error) {
      console.log('[RCON] ❌ 基本命令测试失败:', error.message);
      return false;
    }
  }
}

module.exports = RconClient; 