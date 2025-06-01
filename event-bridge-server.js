const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class EventBridgeServer {
  constructor(danmuListener) {
    this.danmuListener = danmuListener;
    this.server = null;
    this.clients = new Map(); // 存储连接的客户端
    this.isRunning = false;
    this.port = config.eventBridge.port;
    this.host = config.eventBridge.host;
    this.authToken = config.eventBridge.authToken;
  }

  // 启动Event Bridge服务器
  start() {
    if (this.isRunning) {
      console.log('[Event Bridge Server] 服务器已在运行中...');
      return;
    }

    console.log(`[Event Bridge Server] 启动WebSocket服务器...`);
    console.log(`[Event Bridge Server] 监听地址: ${this.host}:${this.port}`);
    
    this.server = new WebSocket.Server({
      port: this.port,
      host: this.host,
      verifyClient: (info) => {
        // 基本验证逻辑
        return true;
      }
    });

    this.server.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.server.on('error', (error) => {
      console.error('[Event Bridge Server] 服务器错误:', error.message);
    });

    this.server.on('listening', () => {
      this.isRunning = true;
      console.log(`[Event Bridge Server] ✅ 服务器启动成功！`);
      console.log(`[Event Bridge Server] 监听地址: ws://${this.host}:${this.port}`);
      console.log(`[Event Bridge Server] 请在LAPLACE Chat中配置此地址作为事件服务器`);
      
      if (this.authToken) {
        console.log(`[Event Bridge Server] 认证令牌: ${this.authToken}`);
      } else {
        console.log(`[Event Bridge Server] 无需认证`);
      }
    });
  }

  // 处理新的WebSocket连接
  handleConnection(ws, request) {
    const clientId = uuidv4();
    const clientInfo = {
      id: clientId,
      ws: ws,
      authenticated: !this.authToken, // 如果没有设置认证令牌，则默认已认证
      connectedAt: new Date(),
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      isLaplaceClient: false
    };

    this.clients.set(clientId, clientInfo);
    
    console.log(`[Event Bridge Server] 新客户端连接: ${clientId}`);
    console.log(`[Event Bridge Server] 来源IP: ${clientInfo.ip}`);
    console.log(`[Event Bridge Server] 当前连接数: ${this.clients.size}`);

    // 发送连接建立消息
    this.sendToClient(clientId, {
      type: 'established',
      clientId: clientId,
      serverInfo: 'Danmu2RCON Event Bridge Server',
      authRequired: !!this.authToken,
      timestamp: Date.now()
    });

    // 设置消息处理
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // 设置连接关闭处理
    ws.on('close', (code, reason) => {
      console.log(`[Event Bridge Server] 客户端断开连接: ${clientId} (代码: ${code})`);
      this.clients.delete(clientId);
      console.log(`[Event Bridge Server] 当前连接数: ${this.clients.size}`);
    });

    // 设置错误处理
    ws.on('error', (error) => {
      console.error(`[Event Bridge Server] 客户端错误 ${clientId}:`, error.message);
    });

    // 发送ping以保持连接
    this.startPingTimer(clientId);
  }

  // 处理客户端消息
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) {
        console.error(`[Event Bridge Server] 未知客户端: ${clientId}`);
        return;
      }

      // 处理认证
      if (message.type === 'auth' && this.authToken) {
        if (message.token === this.authToken) {
          client.authenticated = true;
          this.sendToClient(clientId, {
            type: 'auth_success',
            message: '认证成功',
            timestamp: Date.now()
          });
          console.log(`[Event Bridge Server] 客户端认证成功: ${clientId}`);
        } else {
          this.sendToClient(clientId, {
            type: 'auth_failed',
            message: '认证失败',
            timestamp: Date.now()
          });
          console.log(`[Event Bridge Server] 客户端认证失败: ${clientId}`);
          client.ws.close(1008, 'Authentication failed');
        }
        return;
      }

      // 检查是否已认证
      if (this.authToken && !client.authenticated) {
        this.sendToClient(clientId, {
          type: 'error',
          message: '需要先进行认证',
          timestamp: Date.now()
        });
        return;
      }

      // 处理心跳
      if (message.type === 'ping') {
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: Date.now()
        });
        return;
      }

      // 检测LAPLACE Chat客户端
      if (message.type === 'client_info' && message.client === 'laplace-chat') {
        client.isLaplaceClient = true;
        console.log(`[Event Bridge Server] 检测到LAPLACE Chat客户端: ${clientId}`);
        return;
      }

      // 处理LAPLACE事件
      if (message.type && message.type !== 'pong') {
        this.handleLaplaceEvent(clientId, message);
      }

    } catch (error) {
      console.error(`[Event Bridge Server] 解析消息失败 ${clientId}:`, error.message);
      this.sendToClient(clientId, {
        type: 'error',
        message: '消息格式错误',
        timestamp: Date.now()
      });
    }
  }

  // 处理LAPLACE事件
  handleLaplaceEvent(clientId, event) {
    console.log(`[Event Bridge Server] 收到事件: ${event.type}`);

    // 处理弹幕消息事件
    if (event.type === 'message') {
      const message = event.message || event.data?.message || event.content;
      const username = event.username || event.user?.username || event.data?.user?.username || event.data?.username || '未知用户';
      
      if (message) {
        console.log(`[Event Bridge Server] 弹幕事件: ${username}: ${message}`);
        // 传递给弹幕监听器处理
        this.danmuListener.processMessage(message, username);
      }
    }
    
    // 处理SuperChat事件
    else if (event.type === 'superchat') {
      const username = event.username || '未知用户';
      const price = event.priceNormalized || event.price || 0;
      const message = (event.message || '').substring(0, 30) + (event.message && event.message.length > 30 ? '...' : '');
      console.log(`[Event Bridge Server] SuperChat: ${username} ¥${price} - ${message}`);
      // 传递给弹幕监听器处理
      this.danmuListener.processSuperChat(event);
    }
    
    // 处理礼物事件（包含舰长开通/续费）
    else if (event.type === 'gift') {
      const username = event.username || '未知用户';
      const giftName = event.giftName || '未知礼物';
      const guardType = event.guardType || 0;
      
      if (guardType >= 1 && guardType <= 3) {
        const guardText = ['', '总督', '提督', '舰长'][guardType];
        const price = event.priceNormalized || event.price || 0;
        console.log(`[Event Bridge Server] 舰长开通: ${username} -> ${guardText} (¥${price})`);
        this.danmuListener.processGuardPurchase(event);
      } else {
        console.log(`[Event Bridge Server] 礼物: ${username} -> ${giftName}`);
      }
    }
    
    // 处理MVP事件（舰长相关）
    else if (event.type === 'mvp') {
      const username = event.username || '未知用户';
      const guardType = event.guardType || 0;
      
      if (guardType >= 1 && guardType <= 3) {
        const guardText = ['', '总督', '提督', '舰长'][guardType];
        console.log(`[Event Bridge Server] MVP舰长: ${username} -> ${guardText}`);
        this.danmuListener.processGuardPurchase(event);
      } else {
        console.log(`[Event Bridge Server] MVP事件: ${username}`);
      }
    }
    
    // 处理进场特效事件（简化输出）
    else if (event.type === 'entry-effect') {
      const username = event.username || event.uid || '未知用户';
      const guardType = event.guardType || 0;
      const guardText = guardType > 0 ? ['', '[总督]', '[提督]', '[舰长]'][guardType] : '';
      console.log(`[Event Bridge Server] 进场特效: ${guardText}${username}`);
    }
    
    // 处理其他事件（简化输出）
    else {
      const username = event.username || event.uid || '';
      const briefInfo = username ? ` - ${username}` : '';
      console.log(`[Event Bridge Server] 其他事件: ${event.type}${briefInfo}`);
    }

    // 广播事件给所有其他认证的客户端（除了发送者）
    this.broadcastEvent(event, clientId);
  }

  // 发送消息给指定客户端
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[Event Bridge Server] 发送消息失败 ${clientId}:`, error.message);
      }
    }
  }

  // 广播事件给所有客户端
  broadcastEvent(eventData, excludeClientId = null) {
    const message = {
      ...eventData,
      timestamp: eventData.timestamp || Date.now()
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeClientId && 
          client.authenticated && 
          client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`[Event Bridge Server] 广播失败 ${clientId}:`, error.message);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`[Event Bridge Server] 事件已广播给 ${sentCount} 个客户端`);
    }
  }

  // 启动ping定时器
  startPingTimer(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.pingTimer = setInterval(() => {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(clientId, {
            type: 'ping',
            timestamp: Date.now()
          });
        } else {
          clearInterval(client.pingTimer);
        }
      }, 30000); // 每30秒ping一次
    }
  }

  // 停止服务器
  stop() {
    if (!this.isRunning) {
      console.log('[Event Bridge Server] 服务器未运行');
      return;
    }

    console.log('[Event Bridge Server] 正在停止服务器...');

    // 关闭所有客户端连接
    for (const [clientId, client] of this.clients) {
      try {
        if (client.pingTimer) {
          clearInterval(client.pingTimer);
        }
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.error(`[Event Bridge Server] 关闭客户端连接失败 ${clientId}:`, error.message);
      }
    }

    this.clients.clear();

    // 关闭服务器
    if (this.server) {
      this.server.close(() => {
        console.log('[Event Bridge Server] 服务器已停止');
      });
    }

    this.isRunning = false;
  }

  // 获取服务器状态
  getStatus() {
    const laplaceClients = Array.from(this.clients.values()).filter(c => c.isLaplaceClient);
    
    return {
      isRunning: this.isRunning,
      port: this.port,
      host: this.host,
      clientCount: this.clients.size,
      laplaceClientCount: laplaceClients.length,
      hasAuth: !!this.authToken,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        authenticated: client.authenticated,
        isLaplaceClient: client.isLaplaceClient,
        connectedAt: client.connectedAt,
        ip: client.ip
      }))
    };
  }

  // 更新认证令牌
  updateAuthToken(token) {
    this.authToken = token;
    console.log(`[Event Bridge Server] 认证令牌已更新: ${token ? '已设置' : '已清除'}`);
  }
}

module.exports = EventBridgeServer; 