#!/bin/bash

# =================================================================
# CloudX Analytics Dashboard - Production Deployment Script
# Target: /opt/analytics-dashboard
# =================================================================

# Exit on error
set -e

APP_DIR="/opt/Nodejs/analytics-dashboard"
BACKEND_DIR="$APP_DIR/analytics-dashboard/backend"
FRONTEND_DIR="$APP_DIR/analytics-dashboard/frontend"
LOG_FILE="/var/log/dashboard_deploy.log"

echo "🚀 Starting Production Deployment..."

# 0. Install System Dependencies (Node.js, npm, PM2)
echo "📦 Checking system dependencies..."
if ! command -v node &> /dev/null; then
    echo "⬇️ Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2 globally..."
    sudo npm install -g pm2
fi

REPO_URL="https://github.com/vasu-004/aws-project.git"

# 1. Ensure target directory exists and has correct permissions
echo "📁 Preparing directory structure..."
sudo mkdir -p $(dirname $APP_DIR)
sudo chown -R $USER:$USER $(dirname $APP_DIR)

# 2. Source code acquisition via Git
if [ -d "$APP_DIR/.git" ]; then
    echo "🔄 Repository exists. Pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    echo "📦 Cloning repository from $REPO_URL..."
    git clone $REPO_URL $APP_DIR
fi

# 3. Setup Backend Service
echo "⚙️  Configuring Backend..."
cd $BACKEND_DIR
npm install --production

# 4. Setup Frontend & Build Production Bundle
echo "⚛️  Building Frontend UI..."
cd $FRONTEND_DIR
npm install
npm run build

# 5. Initialize or Restart PM2 Service
echo "🔄 Initializing PM2 Service..."
cd $BACKEND_DIR

# Stop existing if running
pm2 stop analytics-dashboard || true
pm2 delete analytics-dashboard || true

# Start clean
pm2 start server.js --name "analytics-dashboard" --env production

# 6. Persistence
echo "💾 Saving PM2 state..."
pm2 save
# Optional: Setup startup script
# pm2 startup

echo "========================================================="
echo "✅ DEPLOYMENT SUCCESSFUL"
echo "🌐 Dashboard is live on port 3001"
echo "📊 Accessible at: http://<SERVER_IP>:3001"
echo "========================================================="
echo "Logs: pm2 logs analytics-dashboard"
