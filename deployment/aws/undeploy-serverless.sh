#!/bin/bash

# AWS Serverless Undeployment Script for Creator Assignment Matcher
# This script removes all deployed microservices from AWS Lambda

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
echo -e "${BLUE}║   Creator Assignment Matcher - AWS Serverless Removal     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Stage:${NC} $STAGE"
echo -e "${YELLOW}Region:${NC} $REGION"
echo ""

# Confirmation prompt
echo -e "${RED}⚠️  WARNING: This will remove all deployed services!${NC}"
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment removal cancelled."
    exit 0
fi

# Check if Serverless Framework is installed
if ! command -v serverless &> /dev/null && ! command -v sls &> /dev/null; then
    echo -e "${RED}❌ Error: Serverless Framework is not installed.${NC}"
    exit 1
fi

# Remove each service
REMOVED_SERVICES=()
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Removing $service${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    
    SERVICE_PATH="../../services/$service"
    
    if [ ! -d "$SERVICE_PATH" ]; then
        echo -e "${YELLOW}⚠️  Service directory not found: $SERVICE_PATH${NC}"
        continue
    fi
    
    cd "$SERVICE_PATH"
    
    # Remove using Serverless Framework
    echo -e "${YELLOW}🗑️  Removing $service from AWS Lambda...${NC}"
    if serverless remove --stage "$STAGE" --region "$REGION" --verbose; then
        echo -e "${GREEN}✅ $service removed successfully${NC}"
        REMOVED_SERVICES+=("$service")
    else
        echo -e "${RED}❌ Failed to remove $service${NC}"
        FAILED_SERVICES+=("$service")
    fi
    
    cd ../../deployment/aws
    echo ""
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Removal Summary${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ ${#REMOVED_SERVICES[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Successfully removed services:${NC}"
    for service in "${REMOVED_SERVICES[@]}"; do
        echo -e "  - $service"
    done
    echo ""
fi

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed to remove services:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "  - $service"
    done
    echo ""
    exit 1
fi

echo -e "${GREEN}🎉 All services removed successfully!${NC}"
echo ""
