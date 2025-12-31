import boto3
import json
import time
import psutil
import socket
import platform
from datetime import datetime

# Configuration
STREAM_NAME = "AnalyticsStream"
REGION = "ap-south-1"

# Initialize Kinesis client
kinesis_client = boto3.client('kinesis', region_name=REGION)

def get_real_telemetry():
    """Captures actual system telemetry from the local machine."""
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    hostname = socket.gethostname()
    
    # Get the top process (the one using most CPU)
    top_proc = "System"
    top_proc_cpu = 0
    try:
        for proc in psutil.process_iter(['name', 'cpu_percent']):
            if proc.info['cpu_percent'] > top_proc_cpu:
                top_proc_cpu = proc.info['cpu_percent']
                top_proc = proc.info['name']
    except:
        pass

    return {
        "user": hostname, # Real hostname instead of fake user
        "action": f"USAGE_REPORT",
        "page": f"Top Proc: {top_proc} ({top_proc_cpu}%)",
        "timestamp": datetime.utcnow().isoformat(),
        "meta": {
            "browser": f"CPU: {cpu_usage}%",
            "os": f"RAM: {memory.percent}%",
            "ip": socket.gethostbyname(hostname)
        },
        "raw_metrics": {
            "cpu": cpu_usage,
            "memory_pct": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 2)
        }
    }

def main():
    print(f"🚀 CloudX Real-Time Telemetry Producer started.")
    print(f"📡 Capturing live data from {socket.gethostname()} and sending to Kinesis...")
    
    try:
        while True:
            # Capture REAL metrics
            event = get_real_telemetry()
            
            print(f"📡 Sending | Host: {event['user']} | CPU: {event['meta']['browser']} | {event['page']}")
            
            # Put REAL record into Kinesis
            response = kinesis_client.put_record(
                StreamName=STREAM_NAME,
                Data=json.dumps(event),
                PartitionKey=event['user']
            )
            
            print(f"✅ Telemetry Pushed. Seq: {response['SequenceNumber'][-10:]}")
            
            # Send data every 3 seconds for real-time monitoring
            time.sleep(3)
            
    except Exception as e:
        print(f"❌ Error in Real-Time Producer: {e}")

if __name__ == "__main__":
    main()
