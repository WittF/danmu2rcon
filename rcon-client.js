/**
 * RCON客户端 - 支持自定义命令扩展
 * 
 * 自定义命令说明：
 * 1. RANDOM_MONSTER_SPAWN - 随机怪物生成
 *    - 功能：在随机玩家身边随机方向(8-12格距离)生成随机怪物
 *    - 实现：完全通过代码实现随机逻辑，不依赖Minecraft指令系统
 *    - 优势：高性能、真随机、高并发安全
 *    - 用法：在配置文件的commands中使用 "command": "RANDOM_MONSTER_SPAWN"
 *    - 新特性：自动显示具体在哪个玩家身边生成怪物
 * 
 * 变量替换支持：
 * - {lastMonster} - 最后生成的怪物名称（中文）
 * - {targetPlayer} - 目标玩家名称（当前为"随机玩家"）
 * 
 * 智能玩家提醒：
 * - 使用临时标签系统确保消息和怪物生成针对同一玩家
 * - 让被选中的玩家发送消息，所有人都能看到具体是谁身边生成的
 * - 自动清理临时标签，避免冲突
 */

const { Rcon } = require('rcon-client');
const config = require('./config');

class RconClient {
  constructor() {
    this.rcon = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.reconnectDelay = 5000; // 5秒重连延迟
    
    // RCON连接池配置
    this.rconPool = [];
    this.poolSize = 3; // 3个并发连接
    this.poolInitialized = false;
    
    // 随机怪物配置 - 完全随机生成
    this.monsters = [
      // 低危险怪物
      { id: 'minecraft:zombie', name: '僵尸', icon: '🧟', danger: 'low' },
      { id: 'minecraft:skeleton', name: '骷髅', icon: '💀', danger: 'low' },
      { id: 'minecraft:spider', name: '蜘蛛', icon: '🕷️', danger: 'low' },
      { id: 'minecraft:slime', name: '史莱姆', icon: '🟢', danger: 'low' },
      { id: 'minecraft:husk', name: '尸壳', icon: '🏜️', danger: 'low' },
      { id: 'minecraft:stray', name: '流浪者', icon: '❄️', danger: 'low' },
      { id: 'minecraft:drowned', name: '溺尸', icon: '🌊', danger: 'low' },
      { id: 'minecraft:silverfish', name: '蠹虫', icon: '🐛', danger: 'low' },
      { id: 'minecraft:cave_spider', name: '洞穴蜘蛛', icon: '🕸️', danger: 'low' },
      
      // 中危险怪物
      { id: 'minecraft:witch', name: '女巫', icon: '🧙', danger: 'medium' },
      { id: 'minecraft:blaze', name: '烈焰人', icon: '🔥', danger: 'medium' },
      { id: 'minecraft:pillager', name: '掠夺者', icon: '🏹', danger: 'medium' },
      { id: 'minecraft:guardian', name: '守卫者', icon: '🐙', danger: 'medium' },
      { id: 'minecraft:enderman', name: '末影人', icon: '👁️', danger: 'medium' },
      { id: 'minecraft:vindicator', name: '卫道士', icon: '⚔️', danger: 'medium' },
      
      // 高危险怪物  
      { id: 'minecraft:creeper', name: '苦力怕', icon: '💥', danger: 'high' },
      { id: 'minecraft:warden', name: '监守者', icon: '👹', danger: 'high' },
      { id: 'minecraft:elder_guardian', name: '远古守卫者', icon: '👑', danger: 'high' }
    ];
    
    // 保存最后生成的怪物信息（包含危险等级）
    this.lastSpawnedMonsterInfo = null;
  }

  // 生成随机怪物命令
  // 这是一个特殊的自定义命令处理器，用于处理 RANDOM_MONSTER_SPAWN 指令
  // 当配置文件中的命令为 "RANDOM_MONSTER_SPAWN" 时，会调用此方法生成随机怪物和位置
  generateRandomMonsterCommand() {
    // 随机选择怪物
    const selectedMonster = this.monsters[Math.floor(Math.random() * this.monsters.length)];
    
    // 随机选择方向偏移 (更加随机的距离)
    const randomDistance = 8 + Math.floor(Math.random() * 5); // 8-12格距离
    const randomAngle = Math.random() * 2 * Math.PI; // 随机角度
    
    const offsetX = Math.round(randomDistance * Math.cos(randomAngle));
    const offsetZ = Math.round(randomDistance * Math.sin(randomAngle));
    
    // 生成命令 - 使用execute as @r[gamemode=!spectator]排除旁观者模式玩家
    const command = `/execute as @r[gamemode=!spectator] at @s run summon ${selectedMonster.id} ~${offsetX} ~ ~${offsetZ}`;
    
    // 危险等级配置 - 指数级增加的提醒系统
    const dangerConfig = {
      low: {
        color: 'green',
        textColor: 'green', 
        level: '🟢 低危险',
        // 粒子效果 - 温和
        particle: 'minecraft:happy_villager',
        particleCount: 8,
        particleSpread: 1.5,
        extraParticles: [], // 无额外粒子
        // 音效系统 - 温和提醒
        soundDistance: 0, // 仅本人听到
        primarySound: 'minecraft:entity.experience_orb.pickup',
        secondarySound: 'minecraft:block.note_block.pling',
        soundVolume: 0.4,
        // 通知范围 - 小范围
        notificationDistance: 6,
        // 消息前缀
        messagePrefix: '🌱'
      },
      medium: {
        color: 'gold',
        textColor: 'gold',
        level: '🟡 中危险', 
        // 粒子效果 - 明显
        particle: 'minecraft:flame',
        particleCount: 40,
        particleSpread: 3,
        extraParticles: ['minecraft:smoke', 'minecraft:lava'], 
        // 音效系统 - 警告音效
        soundDistance: 20, // 20格内听到
        primarySound: 'minecraft:block.anvil.land',
        secondarySound: 'minecraft:entity.blaze.hurt',
        soundVolume: 0.7,
        // 通知范围 - 中等范围
        notificationDistance: 40,
        // 消息前缀
        messagePrefix: '⚠️'
      },
      high: {
        color: 'red',
        textColor: 'red',
        level: '🔴 高危险',
        // 粒子效果 - 震撼
        particle: 'minecraft:soul_fire_flame', 
        particleCount: 120,
        particleSpread: 5,
        extraParticles: ['minecraft:large_smoke', 'minecraft:lava', 'minecraft:explosion', 'minecraft:dragon_breath'],
        // 音效系统 - 紧急警报
        soundDistance: 80, // 80格内听到
        primarySound: 'minecraft:entity.lightning_bolt.thunder',
        secondarySound: 'minecraft:entity.wither.spawn',
        soundVolume: 1.0,
        // 通知范围 - 大范围
        notificationDistance: 160,
        // 消息前缀
        messagePrefix: '🚨'
      }
    };
    
    console.log(`[RCON] 🎲 随机生成: ${selectedMonster.icon} ${selectedMonster.name} 在偏移(${offsetX}, ${offsetZ}) 距离: ${randomDistance}格`);
    
    const currentDangerConfig = dangerConfig[selectedMonster.danger];
    console.log(`[RCON] 📢 效果范围: 音效${currentDangerConfig.soundDistance === 0 ? '仅本人' : currentDangerConfig.soundDistance + '格'} | 通知${currentDangerConfig.notificationDistance}格 | 粒子${currentDangerConfig.particleCount}个`);
    console.log(`[RCON] 🎵 音效配置: ${currentDangerConfig.primarySound.split(':')[1]} + ${currentDangerConfig.secondarySound.split(':')[1]} (音量${currentDangerConfig.soundVolume})`);
    console.log(`[RCON] ⚡ 性能优化: 使用${this.poolSize}个并发RCON连接，大幅减少延迟`);
    console.log(`[RCON] 🎯 怪物增强: 生成后将锁定目标玩家，增强追踪能力`);
    
    // 返回命令和怪物信息（包含危险等级）
    return {
      command: command,
      monsterName: selectedMonster.name,
      monsterIcon: selectedMonster.icon,
      monsterType: selectedMonster.id,
      dangerLevel: selectedMonster.danger,
      dangerLevelText: currentDangerConfig.level,
      dangerColor: currentDangerConfig.color,
      dangerTextColor: currentDangerConfig.textColor,
      particle: currentDangerConfig.particle,
      particleCount: currentDangerConfig.particleCount,
      particleSpread: currentDangerConfig.particleSpread,
      extraParticles: currentDangerConfig.extraParticles,
      soundDistance: currentDangerConfig.soundDistance,
      notificationDistance: currentDangerConfig.notificationDistance,
      primarySound: currentDangerConfig.primarySound,
      secondarySound: currentDangerConfig.secondarySound,
      soundVolume: currentDangerConfig.soundVolume,
      messagePrefix: currentDangerConfig.messagePrefix,
      distance: randomDistance,
      offsetX: offsetX,
      offsetZ: offsetZ
    };
  }

  // 连接到RCON服务器
  async connect() {
    if (this.isConnected && this.poolInitialized) {
      console.log('[RCON] 连接池已就绪');
      return Promise.resolve();
    }

    try {
      console.log(`[RCON] 正在初始化RCON连接池 (${this.poolSize}个连接)...`);
      
      // 初始化连接池
      await this.initializePool();
      
      this.isConnected = true;
      this.poolInitialized = true;
      this.retryCount = 0;
      console.log('[RCON] ✅ RCON连接池初始化成功');
      
    } catch (error) {
      console.error(`[RCON] ❌ 连接池初始化错误: ${error.message}`);
      this.isConnected = false;
      this.poolInitialized = false;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`[RCON] 🔄 ${this.reconnectDelay/1000}秒后进行第${this.retryCount}次重连...`);
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        return this.connect();
      }
      
      throw error;
    }
  }

  // 初始化RCON连接池
  async initializePool() {
    const promises = [];
    
    for (let i = 0; i < this.poolSize; i++) {
      promises.push(this.createConnection(i));
    }
    
    this.rconPool = await Promise.all(promises);
    console.log(`[RCON] 🏊 连接池已创建 ${this.rconPool.length} 个连接`);
  }

  // 创建单个RCON连接
  async createConnection(index) {
    const { Rcon } = require('rcon-client');
    
    const connection = new Rcon({
      host: config.rcon.host,
      port: config.rcon.port,
      password: config.rcon.password,
      timeout: 5000
    });

    await connection.connect();
    console.log(`[RCON] 连接 #${index} 已建立`);
    
    return {
      connection: connection,
      busy: false,
      index: index
    };
  }

  // 获取可用的RCON连接
  async getAvailableConnection() {
    // 查找空闲连接
    for (const poolItem of this.rconPool) {
      if (!poolItem.busy) {
        poolItem.busy = true;
        return poolItem;
      }
    }
    
    // 如果没有空闲连接，等待一下再重试
    await new Promise(resolve => setTimeout(resolve, 10));
    return this.getAvailableConnection();
  }

  // 释放连接
  releaseConnection(poolItem) {
    if (poolItem) {
      poolItem.busy = false;
    }
  }

  // 使用连接池发送命令
  async sendCommandWithPool(command) {
    const poolItem = await this.getAvailableConnection();
    
    try {
      const response = await poolItem.connection.send(command);
      return response;
    } finally {
      this.releaseConnection(poolItem);
    }
  }

  // 断开连接
  async disconnect() {
    if (this.rconPool && this.rconPool.length > 0) {
      console.log('[RCON] 正在关闭连接池...');
      
      const promises = this.rconPool.map(async (poolItem, index) => {
        try {
          if (poolItem.connection) {
            await poolItem.connection.end();
            console.log(`[RCON] 连接 #${index} 已关闭`);
          }
        } catch (error) {
          console.error(`[RCON] 关闭连接 #${index} 时出错: ${error.message}`);
        }
      });
      
      await Promise.all(promises);
      this.rconPool = [];
      this.poolInitialized = false;
      console.log('[RCON] 🏊 连接池已关闭');
    }
    
    // 兼容旧的单连接方式
    if (this.rcon && this.isConnected) {
      console.log('[RCON] 断开单一连接...');
      await this.rcon.end();
    }
    
    this.isConnected = false;
  }

  // 销毁连接池（专用于配置更新）
  async destroyPool() {
    if (this.rconPool && this.rconPool.length > 0) {
      console.log('[RCON] 🔄 销毁现有连接池...');
      
      const promises = this.rconPool.map(async (poolItem, index) => {
        try {
          if (poolItem.connection) {
            await poolItem.connection.end();
            console.log(`[RCON] 连接池 #${index} 已销毁`);
          }
        } catch (error) {
          console.error(`[RCON] 销毁连接池 #${index} 时出错: ${error.message}`);
        }
      });
      
      await Promise.all(promises);
      this.rconPool = [];
      this.poolInitialized = false;
      console.log('[RCON] ♻️ 连接池已完全销毁');
    }
  }

  // 发送命令
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('RCON未连接，无法发送命令');
    }

    try {
      // 处理特殊的随机怪物生成命令 (RANDOM_MONSTER_SPAWN)
      // 这是一个自定义命令标识符，不是真正的Minecraft命令
      // 当遇到这个标识符时，会生成随机怪物和位置，然后执行实际的summon命令
      if (command === 'RANDOM_MONSTER_SPAWN') {
        const result = this.generateRandomMonsterCommand();
        // 保存当前生成的怪物信息，供后续消息使用
        this.lastSpawnedMonsterInfo = result;
        
        // 生成唯一标签名，避免并发冲突
        const uniqueTag = `danmu_target_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        console.log(`[RCON] 🏷️ 使用唯一标签: ${uniqueTag}`);
        
        // 优化的命令序列 - 减少命令数量，提高并发性能
        const commands = [
          // 1. 随机选择玩家并标记（排除旁观者模式）
          `/tag @r[gamemode=!spectator] add ${uniqueTag}`,
          // 2. 给目标玩家添加发光效果，让怪物更容易发现
          `/execute as @a[tag=${uniqueTag}] run effect give @s minecraft:glowing 15 0 true`,
          // 3. 生成怪物
          result.command.replace('@r[gamemode=!spectator]', `@a[tag=${uniqueTag}]`),
          // 4. 增强怪物的跟踪范围和移动速度
          `/execute as @a[tag=${uniqueTag}] at @s run attribute @e[distance=..15,limit=1,sort=nearest] minecraft:generic.follow_range base set 32`,
          `/execute as @a[tag=${uniqueTag}] at @s run attribute @e[distance=..15,limit=1,sort=nearest] minecraft:generic.movement_speed base set 0.35`,
          // 5. 发送聊天消息
          `/execute as @a[tag=${uniqueTag}] run tellraw @a {"text":"${result.messagePrefix} 弹幕触发！在","color":"${result.dangerColor}","extra":[{"selector":"@s","color":"yellow"},{"text":"身边召唤了${result.monsterIcon} ${result.monsterName}！","color":"${result.dangerTextColor}","bold":true}]}`
        ];

        // 4. 根据危险等级添加合并的音效命令
        if (result.soundDistance === 0) {
          // 低危险：仅本人听到，合并音效
          commands.push(`/execute as @a[tag=${uniqueTag}] at @s run playsound ${result.primarySound} master @s ~ ~ ~ ${result.soundVolume} 1.0`);
        } else {
          // 中高危险：范围音效，使用更震撼的音效组合
          commands.push(`/execute as @a[tag=${uniqueTag}] at @s run playsound ${result.primarySound} master @a[distance=..${result.soundDistance}] ~ ~ ~ ${result.soundVolume} 1.0`);
          if (result.dangerLevel !== 'low') {
            commands.push(`/execute as @a[tag=${uniqueTag}] at @s run playsound ${result.secondarySound} master @a[distance=..${result.soundDistance}] ~ ~ ~ ${result.soundVolume * 0.8} 1.2`);
          }
        }

        // 5. 添加粒子效果命令
        // 主要粒子
        commands.push(`/execute as @a[tag=${uniqueTag}] at @s run particle ${result.particle} ~ ~1 ~ ${result.particleSpread} ${result.particleSpread} ${result.particleSpread} 0.1 ${result.particleCount}`);
        
        // 额外粒子（每个作为单独命令）
        result.extraParticles.forEach((extraParticle, index) => {
          commands.push(`/execute as @a[tag=${uniqueTag}] at @s run particle ${extraParticle} ~ ~${1 + index * 0.5} ~ ${Math.max(1, result.particleSpread - 1)} ${Math.max(1, result.particleSpread - 1)} ${Math.max(1, result.particleSpread - 1)} 0.1 ${Math.floor(result.particleCount * 0.6)}`);
        });
        
        // 6. 状态栏通知
        commands.push(`/execute as @a[tag=${uniqueTag}] at @s run title @a[distance=..${result.notificationDistance}] actionbar {"text":"${result.messagePrefix} 召唤了 ${result.monsterIcon} ${result.monsterName}！","color":"${result.dangerColor}","bold":true}`);
        
        // 7. 清理标签
        commands.push(`/tag @a remove ${uniqueTag}`);
        
        // 并行执行命令以提高性能
        await this.executeCommandsInParallel(commands);
        return; // 提前返回，不继续执行后面的代码
      }
      
      // 处理消息中的变量替换
      if (this.lastSpawnedMonsterInfo) {
        // 基础怪物信息
        command = command.replace(/{lastMonster}/g, this.lastSpawnedMonsterInfo.monsterName);
        command = command.replace(/{monsterIcon}/g, this.lastSpawnedMonsterInfo.monsterIcon);
        command = command.replace(/{monsterType}/g, this.lastSpawnedMonsterInfo.monsterType);
        
        // 危险等级信息
        command = command.replace(/{dangerLevel}/g, this.lastSpawnedMonsterInfo.dangerLevel);
        command = command.replace(/{dangerLevelText}/g, this.lastSpawnedMonsterInfo.dangerLevelText);
        command = command.replace(/{dangerColor}/g, this.lastSpawnedMonsterInfo.dangerColor);
        command = command.replace(/{dangerTextColor}/g, this.lastSpawnedMonsterInfo.dangerTextColor);
        
        // 粒子效果信息
        command = command.replace(/{particle}/g, this.lastSpawnedMonsterInfo.particle);
        command = command.replace(/{particleCount}/g, this.lastSpawnedMonsterInfo.particleCount);
      }
      
      // 处理目标玩家变量替换
      if (command.includes('{targetPlayer}')) {
        // 对于随机玩家，我们使用一种特殊的显示方式
        command = command.replace('{targetPlayer}', '随机玩家');
      }
      
      console.log(`[RCON] 发送命令: ${command}`);
      // 使用连接池发送命令，如果没有连接池则回退到单连接
      const response = this.poolInitialized 
        ? await this.sendCommandWithPool(command)
        : await this.rcon.send(command);
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

  // 真正的并发命令执行方法 - 使用连接池
  async executeCommandsInParallel(commands) {
    try {
      // 确保连接池已初始化
      if (!this.poolInitialized) {
        await this.connect();
      }

      // 重新划分批次，优化执行顺序
      // 批次1：核心命令（标记、效果、生成、增强）- 必须顺序执行
      const coreCommands = commands.slice(0, 5);
      // 批次2：消息和效果命令 - 可以并发执行
      const effectCommands = commands.slice(5, -1);
      // 批次3：清理命令
      const cleanupCommands = commands.slice(-1);

      console.log(`[RCON] 🚀 并发执行 ${commands.length} 个命令 (核心:${coreCommands.length} 效果:${effectCommands.length}) 池大小:${this.poolSize}`);
      
      // 1. 顺序执行核心命令（使用第一个连接）
      for (const cmd of coreCommands) {
        console.log(`[RCON] 核心: ${cmd.substring(0, 60)}...`);
        await this.sendCommandWithPool(cmd);
      }
      
      // 2. 真正并发执行所有效果命令
      const effectPromises = effectCommands.map(async (cmd, index) => {
        try {
          const startTime = Date.now();
          console.log(`[RCON] 并发-${index}: ${cmd.substring(0, 50)}...`);
          const response = await this.sendCommandWithPool(cmd);
          const duration = Date.now() - startTime;
          console.log(`[RCON] ✅ 并发-${index} 完成 (${duration}ms)`);
          return response;
        } catch (error) {
          console.error(`[RCON] ❌ 并发-${index} 失败: ${error.message}`);
          return null;
        }
      });
      
      // 等待所有效果命令完成
      const startTime = Date.now();
      await Promise.all(effectPromises);
      const totalDuration = Date.now() - startTime;
      
      // 3. 短暂等待后执行清理命令
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // 4. 执行清理命令
      for (const cmd of cleanupCommands) {
        console.log(`[RCON] 清理: ${cmd}`);
        await this.sendCommandWithPool(cmd);
      }
      
      console.log(`[RCON] ✅ 并发执行完成 (效果耗时:${totalDuration}ms)`);
      
    } catch (error) {
      console.error(`[RCON] 并发执行失败: ${error.message}`);
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

  // 热更新配置
  async updateConfig(newConfig) {
    const oldConfig = {
      host: config.rcon.host,
      port: config.rcon.port,
      password: config.rcon.password
    };

    const newRconConfig = {
      host: newConfig.rcon.host,
      port: newConfig.rcon.port,
      password: newConfig.rcon.password
    };

    // 检查RCON配置是否发生变化
    const rconChanged = 
      oldConfig.host !== newRconConfig.host ||
      oldConfig.port !== newRconConfig.port ||
      oldConfig.password !== newRconConfig.password;

    if (rconChanged) {
      console.log('[RCON] 🔄 检测到RCON配置变更，重新连接...');
      
      // 断开现有连接
      if (this.isConnected) {
        await this.disconnect();
      }

      // 清空连接池
      if (this.poolInitialized) {
        await this.destroyPool();
      }

      // 尝试使用新配置连接
      try {
        await this.connect();
        console.log('[RCON] ✅ RCON配置热更新成功');
        return true;
      } catch (error) {
        console.error('[RCON] ❌ RCON配置热更新失败:', error.message);
        return false;
      }
    } else {
      console.log('[RCON] ℹ️ RCON配置无变化，跳过重连');
      return true;
    }
  }
}

module.exports = RconClient; 