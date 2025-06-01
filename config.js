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
        "enabled": true,
        "command": "/title @a actionbar {\"text\":\"💰 {username} 发送了 ¥{price} 的SuperChat\",\"color\":\"gold\"}"
      },
      {
        "name": "SuperChat聊天",
        "enabled": true,
        "command": "/tellraw @a {\"text\":\"💰 [SC] \",\"color\":\"gold\",\"extra\":[{\"text\":\"{username}: {message}\",\"color\":\"yellow\"}]}"
      },
      {
        "name": "SuperChat音效",
        "enabled": true,
        "command": "/playsound minecraft:block.note_block.chime master @a ~ ~ ~ 0.5 1.2"
      }
    ],
    "guardCommands": [
      {
        "name": "舰长通知",
        "enabled": true,
        "command": "/title @a actionbar {\"text\":\"{guardIcon} {username} 开通了{guardType} (¥{price})\",\"color\":\"yellow\"}"
      },
      {
        "name": "舰长聊天",
        "enabled": true,
        "command": "/tellraw @a {\"text\":\"{guardIcon} \",\"color\":\"{guardColor}\",\"extra\":[{\"text\":\"{username}\",\"color\":\"gold\"},{\"text\":\" 开通了 \",\"color\":\"white\"},{\"text\":\"{guardType}\",\"color\":\"{guardColor}\",\"bold\":true},{\"text\":\"！感谢支持！\",\"color\":\"yellow\"}]}"
      },
      {
        "name": "舰长音效",
        "enabled": true,
        "command": "/playsound minecraft:block.note_block.bell master @a ~ ~ ~ 0.8 1.5"
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
          "enabled": true,
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:zombie ~ ~ ~"
        },
        {
          "name": "触发消息",
          "enabled": true,
          "command": "/tellraw @a {\"text\":\"💫 弹幕触发！召唤了僵尸！\",\"color\":\"green\"}"
        },
        {
          "name": "庆祝音效",
          "enabled": true,
          "command": "/playsound minecraft:entity.experience_orb.pickup master @a ~ ~ ~ 0.8 1.0"
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
          "enabled": true,
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:vindicator ~ ~ ~"
        },
        {
          "name": "触发消息",
          "enabled": true,
          "command": "/tellraw @a {\"text\":\"⚔️ 弹幕触发！召唤了卫道士！\",\"color\":\"red\"}"
        },
        {
          "name": "特殊音效",
          "enabled": true,
          "command": "/playsound minecraft:entity.vindicator.ambient master @a ~ ~ ~ 1.0 1.0"
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
          "enabled": true,
          "command": "/execute at @a[name=\"WittF\"] run summon minecraft:warden ~ ~ ~"
        },
        {
          "name": "触发消息",
          "enabled": true,
          "command": "/tellraw @a {\"text\":\"💀 弹幕触发！召唤了恐怖的坚守者！\",\"color\":\"dark_purple\",\"bold\":true}"
        },
        {
          "name": "震撼音效",
          "enabled": true,
          "command": "/playsound minecraft:entity.warden.emerge master @a ~ ~ ~ 1.0 0.8"
        },
        {
          "name": "粒子效果",
          "enabled": true,
          "command": "/execute at @a run particle minecraft:sculk_soul ~ ~1 ~ 2 2 2 0.1 50"
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