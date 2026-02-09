#!/bin/bash

# Configuration
STACK_NAME="drumbeat-labs-infra"
REGION="us-east-1"
TEMPLATE_FILE="ecs-fargate.yaml"

echo "🚀 Starting Drumbeat Labs Deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed."
    exit 1
fi

# Deploy CloudFormation Stack
echo "📦 Deploying CloudFormation stack: $STACK_NAME..."
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides EnvironmentName=production ServiceName=api-gateway

if [ $? -eq 0 ]; then
    echo "✅ Infrastructure deployed successfully!"
    echo "🔗 You can now push your Docker images to ECR."
else
    echo "❌ Deployment failed."
    exit 1
fi
