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
      "name": "随机怪物召唤",
      "count": 10,
      "enabled": true,
      "commands": [
        {
          "name": "随机怪物生成",
          "command": "RANDOM_MONSTER_SPAWN",
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