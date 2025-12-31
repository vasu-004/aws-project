#!/bin/bash

# Configuration
REGION="ap-south-1"
STREAM_NAME="AnalyticsStream"
TABLE_NAME="AnalyticsData"
ROLE_NAME="LambdaAnalyticsRole"
FUNCTION_NAME="ProcessAnalyticsData"

# Provided Credentials
AWS_ACCESS_KEY="AKIA2S2Y4JEZ5DPEZZLI"
AWS_SECRET_KEY="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"

echo "🚀 Initializing AWS Infrastructure Deployment..."

# 0. Install and Configure AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⬇️ AWS CLI not found. Attempting to install for Linux..."
    # Install dependencies
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y curl unzip
    elif command -v yum &> /dev/null; then
        yum install -y curl unzip
    fi

    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
    echo "✅ AWS CLI installed."
else
    echo "✅ AWS CLI is already installed."
fi

echo "🔐 Configuring AWS CLI..."
aws configure set aws_access_key_id $AWS_ACCESS_KEY
aws configure set aws_secret_access_key $AWS_SECRET_KEY
aws configure set region $REGION
aws configure set output json

# 1. Create Kinesis Stream
echo "📦 Checking Kinesis Stream: $STREAM_NAME..."
if aws kinesis describe-stream --stream-name $STREAM_NAME --region $REGION &>/dev/null; then
    echo "⏭️ Kinesis Stream already exists. Skipping."
else
    echo "📦 Creating Kinesis Stream: $STREAM_NAME..."
    aws kinesis create-stream --stream-name $STREAM_NAME --shard-count 1 --region $REGION
    aws kinesis wait stream-exists --stream-name $STREAM_NAME --region $REGION
    echo "✅ Kinesis Stream created."
fi

# 2. Create DynamoDB Table
echo "📂 Checking DynamoDB Table: $TABLE_NAME..."
if aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION &>/dev/null; then
    echo "⏭️ DynamoDB Table already exists. Skipping."
else
    echo "📂 Creating DynamoDB Table: $TABLE_NAME..."
    aws dynamodb create-table \
        --table-name $TABLE_NAME \
        --attribute-definitions AttributeName=id,AttributeType=S \
        --key-schema AttributeName=id,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region $REGION
    aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION
    echo "✅ DynamoDB Table created."
fi

# 3. Create IAM Role for Lambda
echo "🔐 Checking IAM Role: $ROLE_NAME..."
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null)

if [ "$ROLE_ARN" != "" ] && [ "$ROLE_ARN" != "None" ]; then
    echo "⏭️ IAM Role already exists. Skipping creation."
else
    echo "🔐 Creating IAM Role: $ROLE_NAME..."
    cat <<EOF > trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    ROLE_ARN=$(aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file://trust-policy.json --query 'Role.Arn' --output text)
    
    # Attach policies
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
    
    echo "⏳ Waiting for IAM role propagation..."
    sleep 15
    echo "✅ IAM Role created: $ROLE_ARN"
fi

# 4. Create Lambda Function Package
echo "💻 Creating Lambda function..."
cat <<EOF > lambda_function.py
import json
import base64
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', '$TABLE_NAME')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    print(f"Processing {len(event['Records'])} records...")
    
    for record in event['Records']:
        # Decode Kinesis data
        payload = base64.b64decode(record['kinesis']['data']).decode('utf-8')
        data = json.loads(payload)
        
        print(f"Ingested record: {data}")
        
        # Add metadata
        item = {
            'id': record['kinesis']['sequenceNumber'],
            'timestamp': datetime.utcnow().isoformat(),
            'raw_data': data,
            'source': 'kinesis-stream'
        }
        
        # Store in DynamoDB
        table.put_item(Item=item)
        
    return {
        'statusCode': 200,
        'body': json.dumps('Data processed successfully')
    }
EOF

zip function.zip lambda_function.py

# 5. Deploy Lambda Function
echo "💻 Checking Lambda Function: $FUNCTION_NAME..."
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text 2>/dev/null)

if [ "$FUNCTION_ARN" != "" ] && [ "$FUNCTION_ARN" != "None" ]; then
    echo "⏭️ Lambda Function already exists. Skipping deployment."
else
    echo "💻 Deploying Lambda Function: $FUNCTION_NAME..."
    FUNCTION_ARN=$(aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime python3.9 \
        --handler lambda_function.lambda_handler \
        --role $ROLE_ARN \
        --zip-file fileb://function.zip \
        --environment Variables={TABLE_NAME=$TABLE_NAME} \
        --region $REGION \
        --query 'FunctionArn' --output text)
    echo "✅ Lambda Function deployed: $FUNCTION_ARN"
fi

# 6. Map Kinesis to Lambda
echo "🔗 Checking Kinesis Source Mapping..."
STREAM_ARN=$(aws kinesis describe-stream --stream-name $STREAM_NAME --region $REGION --query 'StreamDescription.StreamARN' --output text)

MAPPING_EXISTS=$(aws lambda list-event-source-mappings --function-name $FUNCTION_NAME --event-source-arn $STREAM_ARN --region $REGION --query 'EventSourceMappings[0].UUID' --output text 2>/dev/null)

if [ "$MAPPING_EXISTS" != "" ] && [ "$MAPPING_EXISTS" != "None" ]; then
    echo "⏭️ Kinesis to Lambda mapping already exists. Skipping."
else
    echo "🔗 Mapping Kinesis Stream to Lambda..."
    aws lambda create-event-source-mapping \
        --function-name $FUNCTION_NAME \
        --event-source-arn $STREAM_ARN \
        --batch-size 100 \
        --starting-position LATEST \
        --region $REGION
    echo "✅ Event source mapping created."
fi

echo "🔥 Deployment Complete!"
echo "------------------------------------------------"
echo "Stream ARN: $STREAM_ARN"
echo "Lambda ARN: $FUNCTION_ARN"
echo "Table Name: $TABLE_NAME"
echo "------------------------------------------------"
