# 🚀 部署指南

本文档详细说明如何在不同环境中部�?Danmu2RCON 系统�?

## 📋 环境要求

### 基础要求
- **Node.js** 16.0 或更高版�?
- **npm** 7.0 或更高版�?
- **网络连接** 可访问Minecraft服务�?
- **操作系统** Windows、Linux、macOS

### Minecraft服务器要�?
- 启用RCON功能
- 开放RCON端口（默�?5575�?
- 配置RCON密码

## 🖥�?Windows部署

### 1. 安装Node.js
1. 访问 [Node.js官网](https://nodejs.org/)
2. 下载LTS版本（推荐）
3. 运行安装程序，按默认设置安装
4. 打开命令提示符验证：
   ```cmd
   node --version
   npm --version
   ```

### 2. 部署项目
```cmd
# 克隆或下载项�?
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon

# 安装依赖
npm install

# 配置系统（编辑config.js�?
notepad config.js

# 启动系统
npm start
# 或双�?start.bat
```

### 3. 设置为Windows服务（可选）
使用 [node-windows](https://github.com/coreybutler/node-windows)�?

```cmd
# 安装node-windows
npm install -g node-windows

# 创建服务脚本
node install-service.js
```

## 🐧 Linux部署

### 1. 安装Node.js (Ubuntu/Debian)
```bash
# 更新包列�?
sudo apt update

# 安装Node.js和npm
sudo apt install nodejs npm

# 验证安装
node --version
npm --version
```

### 2. 部署项目
```bash
# 克隆项目
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon

# 安装依赖
npm install

# 配置系统
nano config.js

# 启动系统
npm start
```

### 3. 使用PM2管理进程
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start index.js --name "danmu2rcon"

# 设置开机自�?
pm2 startup
pm2 save

# 查看状�?
pm2 status
pm2 logs danmu2rcon
```

## 🍎 macOS部署

### 1. 安装Node.js
```bash
# 使用Homebrew安装
brew install node

# 或从官网下载安装�?
# https://nodejs.org/
```

### 2. 部署项目
```bash
# 克隆项目
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon

# 安装依赖
npm install

# 启动系统
npm start
```

## 🐳 Docker部署

### 1. 创建Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代�?
COPY . .

# 暴露端口
EXPOSE 3000 9696

# 启动应用
CMD ["npm", "start"]
```

### 2. 构建和运�?
```bash
# 构建镜像
docker build -t danmu2rcon .

# 运行容器
docker run -d \
  --name danmu2rcon \
  -p 3000:3000 \
  -p 9696:9696 \
  -v $(pwd)/config.js:/app/config.js \
  danmu2rcon
```

### 3. 使用docker-compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  danmu2rcon:
    build: .
    ports:
      - "3000:3000"
      - "9696:9696"
    volumes:
      - ./config.js:/app/config.js
      - ./logs:/app/logs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## ☁️ 云服务器部署

### 1. 阿里云ECS部署
```bash
# 连接服务�?
ssh root@your-server-ip

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 部署项目
git clone https://github.com/WittF/danmu2rcon.git
cd danmu2rcon
npm install

# 配置防火�?
sudo ufw allow 3000
sudo ufw allow 9696

# 使用PM2启动
npm install -g pm2
pm2 start index.js --name danmu2rcon
pm2 startup
pm2 save
```

### 2. 腾讯云CVM部署
类似阿里云ECS的步骤，注意安全组规则设置�?

### 3. AWS EC2部署
```bash
# 连接实例
ssh -i your-key.pem ubuntu@your-instance-ip

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 部署应用
# ... (同Linux部署步骤)
```

## 🔧 生产环境配置

### 1. 环境变量配置
创建 `.env` 文件�?
```env
NODE_ENV=production
PORT=3000
RCON_HOST=your-minecraft-server
RCON_PORT=25575
RCON_PASSWORD=your-password
EVENT_BRIDGE_PORT=9696
```

### 2. 日志配置
```javascript
// 在index.js中添�?
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### 3. 反向代理设置（Nginx�?
```nginx
# /etc/nginx/sites-available/danmu2rcon
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:9696;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔒 安全设置

### 1. 防火墙配�?
```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw allow 9696

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=9696/tcp
sudo firewall-cmd --reload
```

### 2. HTTPS配置
使用Let's Encrypt�?
```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加�? 12 * * * /usr/bin/certbot renew --quiet
```

### 3. 访问控制
在config.js中配置认证令牌：
```javascript
{
  "eventBridge": {
    "authToken": "your-secure-token"
  }
}
```

## 📊 监控和维�?

### 1. PM2监控
```bash
# 安装PM2监控
pm2 install pm2-server-monit

# 查看监控面板
pm2 monit
```

### 2. 日志轮转
```bash
# 安装logrotate配置
sudo nano /etc/logrotate.d/danmu2rcon
```

```
/home/user/danmu2rcon/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        pm2 reload danmu2rcon
    endscript
}
```

### 3. 健康检查脚�?
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/api/status"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy, restarting..."
    pm2 restart danmu2rcon
    exit 1
fi
```

## 🔧 故障排除

### 常见问题
1. **端口被占�?*
   ```bash
   # 查看端口使用
   netstat -tlnp | grep :3000
   sudo lsof -i :3000
   ```

2. **权限问题**
   ```bash
   # 修改文件权限
   sudo chown -R $USER:$USER /path/to/danmu2rcon
   chmod +x start.bat
   ```

3. **内存不足**
   ```bash
   # 增加swap空间
   sudo fallocate -l 2G /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### 性能优化
1. **Node.js优化**
   ```bash
   # 设置环境变量
   export NODE_ENV=production
   export UV_THREADPOOL_SIZE=128
   ```

2. **PM2集群模式**
   ```bash
   pm2 start index.js -i max --name danmu2rcon
   ```

---

有关更多部署问题，请查看 [故障排除指南](TROUBLESHOOTING.md) �?[创建Issue](https://github.com/WittF/danmu2rcon/issues)�?
