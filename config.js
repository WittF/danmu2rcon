// 配置文件
module.exports = {
  "rcon": {
    "host": "127.0.0.1",
    "port": 25575,
    "password": "Rcon@PSWD"
  },
  "triggerMessage": "666",
  "eventSettings": {
    "superChatEnabled": true,
    "guardPurchaseEnabled": true,
    "superChatCommands": [
      {
        "name": "SuperChat通知",
        "command": "/title @a actionbar {\"text\":\"💰 {username} 发送了 ¥{price} 的SuperChat\",\"color\":\"gold\"}",
        "enabled": true
      },
      {
        "name": "SuperChat聊天",
        "command": "/tellraw @a {\"text\":\"💰 [SC] \",\"color\":\"gold\",\"extra\":[{\"text\":\"{username}: {message}\",\"color\":\"yellow\"}]}",
        "enabled": true
      },
      {
        "name": "SuperChat音效",
        "command": "/playsound minecraft:block.note_block.chime master @a ~ ~ ~ 0.5 1.2",
        "enabled": true
      }
    ],
    "guardCommands": [
      {
        "name": "舰长通知",
        "command": "/title @a actionbar {\"text\":\"{guardIcon} {username} 开通了{guardType} (¥{price})\",\"color\":\"yellow\"}",
        "enabled": true
      },
      {
        "name": "舰长聊天",
        "command": "/tellraw @a {\"text\":\"{guardIcon} \",\"color\":\"{guardColor}\",\"extra\":[{\"text\":\"{username}\",\"color\":\"gold\"},{\"text\":\" 开通了 \",\"color\":\"white\"},{\"text\":\"{guardType}\",\"color\":\"{guardColor}\",\"bold\":true},{\"text\":\"！感谢支持！\",\"color\":\"yellow\"}]}",
        "enabled": true
      },
      {
        "name": "舰长音效",
        "command": "/playsound minecraft:block.note_block.bell master @a ~ ~ ~ 0.8 1.5",
        "enabled": true
      }
    ]
  },
  "commandRules": [
    {
      "name": "僵尸召唤",
      "count": 1,
      "enabled": true,
      "commands": [
        {
          "name": "生成僵尸",
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:zombie ~ ~ ~",
          "enabled": true
        },
        {
          "name": "触发消息",
          "command": "/tellraw @a {\"text\":\"💫 弹幕触发！召唤了僵尸！\",\"color\":\"green\"}",
          "enabled": true
        },
        {
          "name": "庆祝音效",
          "command": "/playsound minecraft:entity.experience_orb.pickup master @a ~ ~ ~ 0.8 1.0",
          "enabled": true
        }
      ]
    },
    {
      "name": "卫道士召唤",
      "count": 5,
      "enabled": true,
      "commands": [
        {
          "name": "生成卫道士",
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:vindicator ~ ~ ~",
          "enabled": true
        },
        {
          "name": "触发消息",
          "command": "/tellraw @a {\"text\":\"⚔️ 弹幕触发！召唤了卫道士！\",\"color\":\"red\"}",
          "enabled": true
        },
        {
          "name": "特殊音效",
          "command": "/playsound minecraft:entity.vindicator.ambient master @a ~ ~ ~ 1.0 1.0",
          "enabled": true
        }
      ]
    },
    {
      "name": "坚守者召唤",
      "count": 10,
      "enabled": true,
      "commands": [
        {
          "name": "生成坚守者",
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:warden ~ ~ ~",
          "enabled": true
        },
        {
          "name": "触发消息",
          "command": "/tellraw @a {\"text\":\"💀 弹幕触发！召唤了恐怖的坚守者！\",\"color\":\"dark_purple\",\"bold\":true}",
          "enabled": true
        },
        {
          "name": "震撼音效",
          "command": "/playsound minecraft:entity.warden.emerge master @a ~ ~ ~ 1.0 0.8",
          "enabled": true
        },
        {
          "name": "粒子效果",
          "command": "/execute at @a run particle minecraft:sculk_soul ~ ~1 ~ 2 2 2 0.1 50",
          "enabled": true
        }
      ]
    }
  ],
  "eventBridge": {
    "port": 9696,
    "host": "0.0.0.0",
    "authToken": null
  },
  "webServer": {
    "port": 3000
  }
};