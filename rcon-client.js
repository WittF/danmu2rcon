const Rcon = require('rcon');
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

    return new Promise((resolve, reject) => {
      console.log(`[RCON] 正在连接到 ${config.rcon.host}:${config.rcon.port}...`);
      
      this.rcon = new Rcon(config.rcon.host, config.rcon.port, config.rcon.password, {
        tcp: true,
        challenge: false
      });

      this.rcon.on('auth', () => {
        console.log('[RCON] ✅ 连接认证成功');
        this.isConnected = true;
        this.retryCount = 0;
        resolve();
      });

      this.rcon.on('response', (str) => {
        console.log(`[RCON] 服务器响应: ${str}`);
      });

      this.rcon.on('error', (err) => {
        console.error(`[RCON] ❌ 连接错误: ${err.message}`);
        this.isConnected = false;
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`[RCON] 🔄 ${this.reconnectDelay/1000}秒后进行第${this.retryCount}次重连...`);
          setTimeout(() => {
            this.connect().catch(() => {}); // 静默处理重连错误
          }, this.reconnectDelay);
        }
        
        reject(err);
      });

      this.rcon.on('end', () => {
        console.log('[RCON] 连接已断开');
        this.isConnected = false;
      });

      // 建立连接
      this.rcon.connect();
    });
  }

  // 断开连接
  disconnect() {
    if (this.rcon && this.isConnected) {
      console.log('[RCON] 断开连接...');
      this.rcon.disconnect();
      this.isConnected = false;
    }
  }

  // 发送命令
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('RCON未连接，无法发送命令');
    }

    return new Promise((resolve, reject) => {
      console.log(`[RCON] 发送命令: ${command}`);
      
      this.rcon.send(command, (err, res) => {
        if (err) {
          console.error(`[RCON] 命令执行失败: ${err.message}`);
          reject(err);
        } else {
          console.log(`[RCON] ✅ 命令执行成功`);
          if (res) {
            console.log(`[RCON] 响应: ${res}`);
          }
          resolve(res);
        }
      });
    });
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
}

module.exports = RconClient; 