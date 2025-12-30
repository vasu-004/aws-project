#!/bin/bash

# =================================================================
# CloudX Analytics Dashboard - Production Deployment Script
# Target: /opt/analytics-dashboard
# =================================================================

# Exit on error
set -e

APP_DIR="/opt/Nodejs/analytics-dashboard"
LOG_FILE="/var/log/dashboard_deploy.log"

echo "🚀 Starting Production Deployment..."

# 1. Ensure target directory exists and has correct permissions
echo "📁 Preparing directory structure..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 2. Copy application source to /opt
# Note: This assumes current script is run from the project root or code is extracted here
echo "📦 Syncing source code to $APP_DIR..."
cp -r . $APP_DIR/

# 3. Setup Backend Service
echo "⚙️  Configuring Backend..."
cd $APP_DIR/backend
npm install --production

# 4. Setup Frontend & Build Production Bundle
echo "⚛️  Building Frontend UI..."
cd $APP_DIR/frontend
npm install
npm run build

# 5. Initialize or Restart PM2 Service
echo "🔄 Initializing PM2 Service..."
cd $APP_DIR/backend

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null
then
    echo "📥 Installing PM2 globally..."
    sudo npm install -g pm2
fi

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
