import psutil
import socket
import time
import json
import requests
import platform
import random
import boto3
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3001" 
AGENT_ID = socket.gethostname()
INTERVAL = 5  # Seconds - matching the stream flow

# AWS Kinesis Config
STREAM_NAME = "AnalyticsStream"
REGION = "ap-south-1"
AWS_ACCESS_KEY = "AKIA2S2Y4JEZ5DPEZZLI"
AWS_SECRET_KEY = "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"

# Simulation Data
USERS = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi']
ACTIONS = ['login', 'purchase', 'view_item', 'logout', 'signup', 'click_ad', 'search']
PAGES = ['/home', '/products', '/cart', '/checkout', '/profile', '/settings', '/search']
BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge']
OSS = ['Windows', 'macOS', 'Linux', 'iOS', 'Android']

# Initialize Kinesis Client
try:
    kinesis_client = boto3.client(
        'kinesis',
        region_name=REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY
    )
    print("✅ AWS Kinesis Client Initialized")
except Exception as e:
    kinesis_client = None
    print(f"❌ Kinesis Initialization Failed: {e}")

def get_app_event():
    """Generates a pseudo-random application event."""
    return {
        "user": random.choice(USERS),
        "action": random.choice(ACTIONS),
        "page": random.choice(PAGES),
        "timestamp": datetime.utcnow().isoformat(),
        "meta": {
            "browser": random.choice(BROWSERS),
            "os": random.choice(OSS),
            "ip": "172.31.0.77"
        }
    }

def get_system_stats():
    """Collects comprehensive real-time system metrics."""
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    net_io = psutil.net_io_counters()

    # Process list
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            pinfo = proc.info
            processes.append({
                "pid": pinfo['pid'],
                "name": pinfo['name'],
                "cpu": pinfo['cpu_percent'],
                "mem": round(pinfo['memory_info'].rss / (1024 * 1024), 2)
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    # Sort by CPU and take top 10
    processes = sorted(processes, key=lambda x: x['cpu'], reverse=True)[:10]

    return {
        "system": {
            "platform": platform.system().lower(),
            "hostname": AGENT_ID,
            "distro": f"{platform.system()} {platform.release()}",
            "uptime": int(time.time() - psutil.boot_time()),
            "cpu_model": platform.processor(),
            "python_version": platform.python_version()
        },
        "cpu": {
            "usage": cpu_usage,
            "cores": psutil.cpu_count(),
            "speed": psutil.cpu_freq().current / 1000 if psutil.cpu_freq() else 0,
            "threads": psutil.cpu_count(logical=True)
        },
        "memory": {
            "total": round(memory.total / (1024**3), 2),
            "used": round(memory.used / (1024**3), 2),
            "percentage": memory.percent,
            "available": round(memory.available / (1024**3), 2)
        },
        "storage": [
            {
                "drive": "/",
                "total": round(disk.total / (1024**3), 2),
                "used": round(disk.used / (1024**3), 2),
                "percentage": disk.percent,
                "free": round(disk.free / (1024**3), 2)
            }
        ],
        "network": [
            {
                "iface": "primary",
                "rx": round(net_io.bytes_recv / 1024, 2),
                "tx": round(net_io.bytes_sent / 1024, 2),
                "operstate": "up"
            }
        ],
        "processes": processes,
        "timestamp": datetime.now().isoformat()
    }

def main():
    print(f"🚀 CloudX Analytics Agent started on {AGENT_ID}")
    print(f"📡 Reporting Metrics to {BACKEND_URL}")
    print(f"🔥 Pushing Stream Events to AWS Kinesis: {STREAM_NAME}")
    
    while True:
        try:
            # 1. Collect System Stats
            stats = get_system_stats()
            
            # 2. Generate Analytics Event
            app_event = get_app_event()
            
            # 3. Create Kinesis Record
            kinesis_record = {
                "id": f"EVT-{random.randint(1000, 9999)}",
                "sequenceNumber": str(int(time.time() * 1000)),
                "data": app_event
            }

            # 4. Push to AWS Kinesis (The "Real" Stream)
            if kinesis_client:
                try:
                    kinesis_client.put_record(
                        StreamName=STREAM_NAME,
                        Data=json.dumps(app_event),
                        PartitionKey=app_event['user']
                    )
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Pushed to Kinesis: {app_event['user']} -> {app_event['action']}")
                except Exception as e:
                    print(f"⚠️ Kinesis Push Error: {e}")

            # 5. Push to Dashboard Backend (For the "Live" View)
            payload = {
                "stats": stats,
                "kinesis_event": kinesis_record
            }
            
            try:
                requests.post(f"{BACKEND_URL}/agent_data", json=payload, timeout=2)
            except:
                pass
            
            time.sleep(INTERVAL)
        except Exception as e:
            print(f"❌ Loop Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
