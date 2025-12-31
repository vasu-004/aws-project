import boto3
import json
import time
import random
from datetime import datetime

# Configuration
STREAM_NAME = "AnalyticsStream"
REGION = "ap-south-1"

# Initialize Kinesis client
# Note: Ensure AWS credentials are configured (e.g., via ~/.aws/credentials or env vars)
kinesis_client = boto3.client('kinesis', region_name=REGION)

def generate_event():
    """Generates a simulated user activity event."""
    users = ["admin_user", "guest_42", "dev_lead", "ops_manager", "security_audit"]
    actions = ["login", "view_dashboard", "update_settings", "export_report", "delete_resource", "failed_auth"]
    pages = ["/dashboard", "/settings", "/analytics", "/users", "/api/v1/resource"]
    browsers = ["Chrome", "Firefox", "Safari", "Edge"]
    os_list = ["Windows 11", "macOS Sonoma", "Ubuntu 22.04", "iOS 17"]
    
    return {
        "user": random.choice(users),
        "action": random.choice(actions),
        "page": random.choice(pages),
        "timestamp": datetime.utcnow().isoformat(),
        "meta": {
            "browser": random.choice(browsers),
            "os": random.choice(os_list),
            "ip": f"192.168.1.{random.randint(1, 254)}"
        }
    }

def main():
    print(f"🚀 CloudX Kinesis Producer started. Sending to: {STREAM_NAME}")
    
    try:
        while True:
            event = generate_event()
            print(f"📡 Sending Event: {event['user']} -> {event['action']} on {event['page']}")
            
            # Put record into Kinesis
            response = kinesis_client.put_record(
                StreamName=STREAM_NAME,
                Data=json.dumps(event),
                PartitionKey=event['user']
            )
            
            print(f"✅ Record Pushed. SequenceNumber: {response['SequenceNumber'][-10:]}")
            
            # Wait for 3-7 seconds to simulate human interaction
            time.sleep(random.uniform(3, 7))
            
    except Exception as e:
        print(f"❌ Error in Producer: {e}")
        print("💡 Hint: Make sure the Kinesis stream exists and credentials are set.")

if __name__ == "__main__":
    main()
