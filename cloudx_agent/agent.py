import psutil
import socket
import time
import json
import requests
import platform
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3001"  # Update this to your server IP
AGENT_ID = socket.gethostname()
INTERVAL = 2  # Seconds

def get_system_stats():
    """Collects real-time system metrics."""
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
    print(f"🚀 CloudX Agent started on {AGENT_ID}")
    print(f"📡 Reporting to {BACKEND_URL}")
    
    while True:
        try:
            stats = get_system_stats()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sending metrics... CPU: {stats['cpu']['usage']}% | RAM: {stats['memory']['percentage']}%")
            
            # Send to backend
            try:
                # In a real scenario, you'd use socketio-client here
                # Simulation: sending to an agent ingest endpoint
                requests.post(f"{BACKEND_URL}/agent_data", json=stats, timeout=1)
            except:
                pass
            
            time.sleep(INTERVAL)
        except Exception as e:
            print(f"❌ Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
