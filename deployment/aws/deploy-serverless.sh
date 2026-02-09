#!/bin/bash

# AWS Serverless Deployment Script for Creator Assignment Matcher
# This script deploys all microservices to AWS Lambda using Serverless Framework

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE="${1:-dev}"
REGION="${2:-us-east-1}"
SERVICES=("assignment-service" "creator-service" "matching-service")

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Creator Assignment Matcher - AWS Serverless Deployment  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Stage:${NC} $STAGE"
echo -e "${YELLOW}Region:${NC} $REGION"
echo ""

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI is not installed.${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if Serverless Framework is installed
if ! command -v serverless &> /dev/null && ! command -v sls &> /dev/null; then
    echo -e "${RED}❌ Error: Serverless Framework is not installed.${NC}"
    echo "Please install Serverless Framework: npm install -g serverless"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed.${NC}"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Error: AWS credentials not configured.${NC}"
    echo "Please configure AWS credentials: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Check environment variables
echo -e "${BLUE}🔍 Checking environment variables...${NC}"

REQUIRED_VARS=("MONGODB_URI" "PINECONE_API_KEY" "OPENAI_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "  - $var"
    done
    echo ""
    echo "Please set these variables in your environment or .env file"
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Install dependencies for shared module
echo -e "${BLUE}📦 Installing shared module dependencies...${NC}"
cd ../../shared
npm install
cd ../deployment/aws
echo -e "${GREEN}✅ Shared module dependencies installed${NC}"
echo ""

# Deploy each service
DEPLOYED_SERVICES=()
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Deploying $service${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    
    SERVICE_PATH="../../services/$service"
    
    if [ ! -d "$SERVICE_PATH" ]; then
        echo -e "${RED}❌ Error: Service directory not found: $SERVICE_PATH${NC}"
        FAILED_SERVICES+=("$service")
        continue
    fi
    
    cd "$SERVICE_PATH"
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing dependencies for $service...${NC}"
    npm install
    
    # Deploy using Serverless Framework
    echo -e "${YELLOW}🚀 Deploying $service to AWS Lambda...${NC}"
    if serverless deploy --stage "$STAGE" --region "$REGION" --verbose; then
        echo -e "${GREEN}✅ $service deployed successfully${NC}"
        DEPLOYED_SERVICES+=("$service")
        
        # Get the service endpoint
        ENDPOINT=$(serverless info --stage "$STAGE" --region "$REGION" | grep "endpoint:" | awk '{print $2}')
        if [ -n "$ENDPOINT" ]; then
            echo -e "${GREEN}🔗 Endpoint: $ENDPOINT${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to deploy $service${NC}"
        FAILED_SERVICES+=("$service")
    fi
    
    cd ../../deployment/aws
    echo ""
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deployment Summary${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ ${#DEPLOYED_SERVICES[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Successfully deployed services:${NC}"
    for service in "${DEPLOYED_SERVICES[@]}"; do
        echo -e "  - $service"
    done
    echo ""
fi

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed to deploy services:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "  - $service"
    done
    echo ""
    exit 1
fi

echo -e "${GREEN}🎉 All services deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the deployed services using the endpoints above"
echo "2. Deploy the frontend to S3 + CloudFront or Vercel"
echo "3. Update frontend API_BASE URL to point to API Gateway"
echo "4. Set up custom domain names (optional)"
echo "5. Configure monitoring and alerts"
echo ""
echo -e "${BLUE}To view logs:${NC} serverless logs -f <function-name> --stage $STAGE --region $REGION"
echo -e "${BLUE}To remove deployment:${NC} ./undeploy-serverless.sh $STAGE $REGION"
echo ""
