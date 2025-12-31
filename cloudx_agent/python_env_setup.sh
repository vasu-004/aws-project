#!/bin/bash

# =================================================================
# CloudX Agent - Python Environment Setup Script
# =================================================================

# Exit on error
set -e

echo "🚀 Starting Python environment setup for CloudX Agent..."

# 1. Update package lists
echo "📦 Updating package lists..."
sudo apt-get update -y

# 2. Install Python3, Pip, and Venv if not present
echo "📦 Installing Python3 and dependencies..."
sudo apt-get install -y python3 python3-pip python3-venv

# 3. Create Virtual Environment
if [ ! -d "venv" ]; then
    echo "🛠️ Creating virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists."
fi

# 4. Activate Virtual Environment and Install Requirements
echo "🔌 Activating virtual environment..."
source venv/bin/activate

echo "⬆️ Upgrading pip..."
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
    echo "📥 Installing dependencies from requirements.txt..."
    pip install -r requirements.txt
else
    echo "⚠️ requirements.txt not found! Installing default dependencies..."
    pip install psutil requests python-socketio[client] boto3
fi

echo ""
echo "========================================================="
echo "✅ SETUP COMPLETE"
echo "========================================================="
echo "To run the agent, use these commands:"
echo "  source venv/bin/activate"
echo "  python agent.py"
echo "========================================================="
