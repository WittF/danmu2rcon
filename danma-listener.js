const config = require('./config');

class DanmuListener {
  constructor(rconClient) {
    this.rconClient = rconClient;
    this.isActive = false;
    
    // 新增：总累计关键词统计
    this.totalKeywordCount = 0;
    
    // 为每个规则创建独立的计数器
    this.ruleCounters = {};
    config.commandRules.forEach((rule, index) => {
      this.ruleCounters[index] = {
        count: 0,
        rule: rule,
        triggeredTimes: 0 // 新增：记录触发次数
      };
    });
  }

  // 启动弹幕监听器
  async start() {
    if (this.isActive) {
      console.log('[弹幕监听] 已激活');
      return;
    }

    console.log('[弹幕监听] 启动弹幕事件处理器...');
    
    // 确保RCON连接
    if (!this.rconClient.isConnected) {
      console.log('[弹幕监听] 正在连接RCON服务器...');
      try {
        await this.rconClient.connect();
        console.log('[弹幕监听] RCON连接成功');
      } catch (error) {
        console.error('[弹幕监听] RCON连接失败，但监听器仍将启动:', error.message);
      }
    }
    
    console.log(`[弹幕监听] 触发关键词: "${config.triggerMessage}"`);
    console.log('[弹幕监听] 事件计数器:');
    config.commandRules.forEach((rule, index) => {
      const commandCount = rule.commands ? rule.commands.length : 1;
      console.log(`  - 事件${index + 1}: ${rule.count}个"${config.triggerMessage}" -> ${rule.name} (${commandCount}个命令)`);
    });

    this.isActive = true;
    console.log('[弹幕监听] ✅ 等待Event Bridge接收弹幕事件...');
  }

  // 处理弹幕消息（由Event Bridge调用）
  processMessage(message, username) {
    if (!this.isActive) {
      console.log('[弹幕监听] 监听器未激活，忽略消息');
      return;
    }

    // 检查是否精确匹配触发关键词
    if (message === config.triggerMessage) {
      console.log(`[弹幕监听] ${username}: ${message}`);
      
      // 增加总累计关键词计数
      this.totalKeywordCount++;
      console.log(`[弹幕监听] 📊 累计收到关键词: ${this.totalKeywordCount}个`);
      
      // 同时为所有启用的事件的计数器+1
      Object.keys(this.ruleCounters).forEach(ruleIndex => {
        const counter = this.ruleCounters[ruleIndex];
        
        // 检查规则是否启用
        if (counter.rule.enabled === false) {
          return; // 跳过未启用的规则
        }
        
        counter.count++;
        
        console.log(`[弹幕监听] 事件${parseInt(ruleIndex) + 1}(${counter.rule.name})计数: ${counter.count}/${counter.rule.count}`);
        
        // 检查是否达到触发条件
        if (counter.count >= counter.rule.count) {
          counter.triggeredTimes++; // 增加触发次数
          this.triggerMonsterSpawn(counter.rule, ruleIndex);
          // 重置该事件的计数器
          counter.count = 0;
          console.log(`[弹幕监听] 🔄 事件${parseInt(ruleIndex) + 1}(${counter.rule.name})计数器已重置`);
        }
      });
    }
  }

  // 触发怪物生成
  async triggerMonsterSpawn(rule, ruleIndex) {
    console.log(`[弹幕监听] 🎯 事件${parseInt(ruleIndex) + 1}触发！执行${rule.name}`);
    
    try {
      const success = await this.rconClient.executeEventTrigger(rule, rule.name);

      if (success !== false) {
        console.log(`[弹幕监听] ✅ 成功执行${rule.name}！`);
      } else {
        console.log(`[弹幕监听] ❌ 执行${rule.name}失败`);
      }
    } catch (error) {
      console.error(`[弹幕监听] 执行${rule.name}时出错:`, error.message);
    }
  }

  // 停止监听
  stop(disconnectRcon = true) {
    this.isActive = false;
    console.log('[弹幕监听] 已停止');
    
    // 可选择性断开RCON连接
    if (disconnectRcon && this.rconClient.isConnected) {
      console.log('[弹幕监听] 断开RCON连接...');
      this.rconClient.disconnect();
    }
  }

  // 获取当前状态
  getStatus() {
    const counters = {};
    Object.keys(this.ruleCounters).forEach(ruleIndex => {
      const counter = this.ruleCounters[ruleIndex];
      counters[`event_${parseInt(ruleIndex) + 1}`] = {
        name: counter.rule.name,
        count: counter.count,
        required: counter.rule.count,
        progress: `${counter.count}/${counter.rule.count}`,
        triggeredTimes: counter.triggeredTimes
      };
    });

    return {
      isActive: this.isActive,
      triggerMessage: config.triggerMessage,
      counters: counters,
      rules: config.commandRules,
      totalKeywordCount: this.totalKeywordCount // 新增：返回总累计关键词数
    };
  }

  // 重置所有计数器
  resetCounter() {
    Object.keys(this.ruleCounters).forEach(ruleIndex => {
      this.ruleCounters[ruleIndex].count = 0;
    });
    // 不重置总累计数，保持历史记录
    console.log('[弹幕监听] 所有事件计数器已重置');
  }

  // 重置特定事件计数器
  resetEventCounter(eventIndex) {
    if (this.ruleCounters[eventIndex]) {
      this.ruleCounters[eventIndex].count = 0;
      const eventName = this.ruleCounters[eventIndex].rule.name;
      console.log(`[弹幕监听] 事件${eventIndex + 1}(${eventName})计数器已重置`);
    }
  }

  // 手动触发测试
  async testTrigger(ruleIndex = 0) {
    if (ruleIndex >= 0 && ruleIndex < config.commandRules.length) {
      const rule = config.commandRules[ruleIndex];
      console.log(`[弹幕监听] 🧪 手动测试触发: ${rule.name}`);
      await this.triggerMonsterSpawn(rule, ruleIndex);
    }
  }

  // 模拟弹幕处理（用于测试）
  simulateMessage(message = config.triggerMessage, username = '测试用户') {
    console.log(`[弹幕监听] 模拟弹幕: ${username}: ${message}`);
    this.processMessage(message, username);
  }

  // 处理SuperChat事件
  processSuperChat(event) {
    if (!this.isActive) {
      console.log('[弹幕监听] 监听器未激活，忽略SuperChat事件');
      return;
    }

    if (!config.eventSettings.superChatEnabled) {
      console.log('[弹幕监听] SuperChat监听已关闭');
      return;
    }

    const username = event.username || '未知用户';
    const message = event.message || '';
    const price = event.price || 0;
    const priceNormalized = event.priceNormalized || price;
    const guardType = event.guardType || 0;

    // 获取舰长等级文本
    const guardText = this.getGuardTypeText(guardType);
    
    console.log(`[弹幕监听] 💰 SuperChat: ${username}${guardText} 发送了 ${priceNormalized}元 SC: ${message}`);
    
    // 发送MC提醒消息
    this.sendSuperChatNotification(username, price, message, guardText);
  }

  // 处理舰长/提督/总督开通/续费事件
  processGuardPurchase(event) {
    if (!this.isActive) {
      console.log('[弹幕监听] 监听器未激活，忽略舰长开通事件');
      return;
    }

    if (!config.eventSettings.guardPurchaseEnabled) {
      console.log('[弹幕监听] 舰长监听已关闭');
      return;
    }

    const username = event.username || '未知用户';
    const guardType = event.guardType || 0;
    const giftName = event.giftName || event.message || '';
    const price = event.price || 0;
    const priceNormalized = event.priceNormalized || price;
    
    // 只处理舰长等级的开通/续费（1-3）
    if (guardType >= 1 && guardType <= 3) {
      const guardText = this.getGuardTypeText(guardType);
      console.log(`[弹幕监听] ⚓ 舰长开通/续费: ${username} 开通了${guardText} (${priceNormalized}元)`);
      
      // 根据不同等级发送不同的MC提醒消息
      this.sendGuardPurchaseNotification(username, guardText, priceNormalized, guardType);
    }
  }

  // 获取舰长等级文本
  getGuardTypeText(guardType) {
    switch (guardType) {
      case 1: return '[总督]';
      case 2: return '[提督]';
      case 3: return '[舰长]';
      default: return '';
    }
  }

  // 发送SuperChat MC通知
  async sendSuperChatNotification(username, price, message, guardText) {
    try {
      if (!config.eventSettings.superChatCommands) {
        console.log('[弹幕监听] SuperChat命令配置未找到，使用默认处理');
        return;
      }

      // 执行所有启用的SuperChat命令
      for (const cmdConfig of config.eventSettings.superChatCommands) {
        if (cmdConfig.enabled) {
          let command = cmdConfig.command
            .replace(/{username}/g, username)
            .replace(/{price}/g, price)
            .replace(/{message}/g, message.replace(/"/g, '\\"'))
            .replace(/{guardText}/g, guardText);

          await this.rconClient.sendCommand(command);
          console.log(`[弹幕监听] ✅ 执行SuperChat命令: ${cmdConfig.name}`);
        }
      }
    } catch (error) {
      console.error(`[弹幕监听] SuperChat通知发送失败:`, error.message);
    }
  }

  // 发送舰长开通/续费MC通知（配置化版本）
  async sendGuardPurchaseNotification(username, guardText, price, guardType) {
    try {
      if (!config.eventSettings.guardCommands) {
        console.log('[弹幕监听] 舰长命令配置未找到，使用默认处理');
        return;
      }

      // 根据舰长等级设置变量
      let guardIcon, guardColor, guardTypeName;
      switch (guardType) {
        case 1: // 总督
          guardIcon = '👑';
          guardColor = 'light_purple';
          guardTypeName = '总督';
          break;
        case 2: // 提督
          guardIcon = '⚓';
          guardColor = 'blue';
          guardTypeName = '提督';
          break;
        case 3: // 舰长
          guardIcon = '🚢';
          guardColor = 'aqua';
          guardTypeName = '舰长';
          break;
        default:
          guardIcon = '⭐';
          guardColor = 'yellow';
          guardTypeName = '未知';
      }

      // 执行所有启用的舰长命令
      for (const cmdConfig of config.eventSettings.guardCommands) {
        if (cmdConfig.enabled) {
          let command = cmdConfig.command
            .replace(/{username}/g, username)
            .replace(/{price}/g, price)
            .replace(/{guardText}/g, guardText)
            .replace(/{guardIcon}/g, guardIcon)
            .replace(/{guardColor}/g, guardColor)
            .replace(/{guardType}/g, guardTypeName);

          await this.rconClient.sendCommand(command);
          console.log(`[弹幕监听] ✅ 执行舰长命令: ${cmdConfig.name}`);
        }
      }
    } catch (error) {
      console.error(`[弹幕监听] ${guardText}开通通知发送失败:`, error.message);
    }
  }

  // 切换SuperChat监听状态
  toggleSuperChatListener() {
    config.eventSettings.superChatEnabled = !config.eventSettings.superChatEnabled;
    const status = config.eventSettings.superChatEnabled ? '启用' : '关闭';
    console.log(`[弹幕监听] SuperChat监听已${status}`);
    return config.eventSettings.superChatEnabled;
  }

  // 切换舰长监听状态
  toggleGuardListener() {
    config.eventSettings.guardPurchaseEnabled = !config.eventSettings.guardPurchaseEnabled;
    const status = config.eventSettings.guardPurchaseEnabled ? '启用' : '关闭';
    console.log(`[弹幕监听] 舰长监听已${status}`);
    return config.eventSettings.guardPurchaseEnabled;
  }

  // 获取特殊事件状态
  getSpecialEventStatus() {
    return {
      superChatEnabled: config.eventSettings.superChatEnabled,
      guardPurchaseEnabled: config.eventSettings.guardPurchaseEnabled
    };
  }

  // 测试SuperChat事件
  async testSuperChat() {
    console.log(`[弹幕监听] 🧪 测试SuperChat事件`);
    const testEvent = {
      username: '测试用户',
      message: '这是一条测试SuperChat消息！',
      price: 50,
      priceNormalized: 50,
      guardType: 3 // 舰长
    };
    await this.processSuperChat(testEvent);
  }

  // 测试舰长开通事件
  async testGuardPurchase() {
    console.log(`[弹幕监听] 🧪 测试舰长开通事件`);
    const testEvent = {
      username: '测试用户',
      guardType: 3, // 舰长
      price: 198,
      priceNormalized: 198,
      giftName: '舰长'
    };
    await this.processGuardPurchase(testEvent);
  }

  // 测试不同等级舰长开通事件
  async testGuardPurchaseByLevel(level = 3) {
    const guardLevels = {
      1: { name: '总督', price: 1998, icon: '👑' },
      2: { name: '提督', price: 998, icon: '⚓' }, 
      3: { name: '舰长', price: 198, icon: '🚢' }
    };

    const guardInfo = guardLevels[level] || guardLevels[3];
    
    console.log(`[弹幕监听] 🧪 测试${guardInfo.name}开通事件 ${guardInfo.icon}`);
    
    const testEvent = {
      username: `测试${guardInfo.name}`,
      guardType: level,
      price: guardInfo.price,
      priceNormalized: guardInfo.price,
      giftName: guardInfo.name
    };
    
    await this.processGuardPurchase(testEvent);
  }
}

module.exports = DanmuListener; 