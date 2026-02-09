# AWS Deployment Guide

This guide covers deploying the Creator Assignment Matcher application to AWS using two approaches:
1. **Serverless (Lambda)** - Recommended for production
2. **Container (ECS Fargate)** - Alternative for container-based deployments

## Table of Contents

- [Prerequisites](#prerequisites)
- [Serverless Deployment (Lambda)](#serverless-deployment-lambda)
- [Container Deployment (ECS Fargate)](#container-deployment-ecs-fargate)
- [Frontend Deployment](#frontend-deployment)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.x or higher)
   ```bash
   # Install AWS CLI
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Verify installation
   aws --version
   ```

2. **Node.js** (v18.x or higher)
   ```bash
   node --version  # Should be v18.x or higher
   npm --version
   ```

3. **Serverless Framework** (for Lambda deployment)
   ```bash
   npm install -g serverless
   serverless --version
   ```

4. **Docker** (for container deployment)
   ```bash
   docker --version
   ```

### AWS Account Setup

1. **Configure AWS Credentials**
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter your default region (e.g., us-east-1)
   # Enter your default output format (json)
   ```

2. **Verify AWS Access**
   ```bash
   aws sts get-caller-identity
   ```

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# MongoDB Connection (use MongoDB Atlas for production)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/creator-matcher?retryWrites=true&w=majority

# Pinecone Vector Database
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=creator-embeddings

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Optional: Custom configuration
LOG_LEVEL=info
NODE_ENV=production
```

**Important:** Never commit the `.env` file to version control!

---

## Serverless Deployment (Lambda)

This is the recommended approach for production deployments. It provides:
- Auto-scaling
- Pay-per-use pricing
- Zero server management
- High availability

### Step 1: Install Dependencies

```bash
# From project root
cd shared
npm install

cd ../services/assignment-service
npm install

cd ../creator-service
npm install

cd ../matching-service
npm install
```

### Step 2: Configure Serverless Plugins

Each service needs the serverless plugins installed:

```bash
# In each service directory
npm install --save-dev serverless-offline serverless-warmup serverless-dotenv-plugin
```

### Step 3: Deploy All Services

```bash
# From deployment/aws directory
cd deployment/aws

# Make the script executable
chmod +x deploy-serverless.sh

# Deploy to dev environment
./deploy-serverless.sh dev us-east-1

# Deploy to production environment
./deploy-serverless.sh prod us-east-1
```

The script will:
1. Check all prerequisites
2. Validate environment variables
3. Install dependencies for each service
4. Deploy each service to AWS Lambda
5. Display the API endpoints

### Step 4: Verify Deployment

After deployment, you'll see output like:

```
✅ Successfully deployed services:
  - assignment-service
  - creator-service
  - matching-service

🔗 Endpoints:
  - assignment-service: https://abc123.execute-api.us-east-1.amazonaws.com/dev
  - creator-service: https://def456.execute-api.us-east-1.amazonaws.com/dev
  - matching-service: https://ghi789.execute-api.us-east-1.amazonaws.com/dev
```

Test the health endpoints:

```bash
# Test assignment service
curl https://abc123.execute-api.us-east-1.amazonaws.com/dev/health

# Test creator service
curl https://def456.execute-api.us-east-1.amazonaws.com/dev/health

# Test matching service
curl https://ghi789.execute-api.us-east-1.amazonaws.com/dev/health
```

### Step 5: Deploy API Gateway (Optional)

If you want a unified API endpoint, deploy an API Gateway:

```bash
cd ../../services/api-gateway
npm install
serverless deploy --stage dev --region us-east-1
```

### Individual Service Deployment

To deploy a single service:

```bash
cd services/assignment-service
serverless deploy --stage dev --region us-east-1

# View service info
serverless info --stage dev --region us-east-1

# View logs
serverless logs -f createAssignment --stage dev --region us-east-1 --tail
```

### Undeploy Services

To remove all deployed services:

```bash
cd deployment/aws
chmod +x undeploy-serverless.sh
./undeploy-serverless.sh dev us-east-1
```

---

## Container Deployment (ECS Fargate)

This approach uses Docker containers on AWS ECS Fargate.

### Step 1: Build Docker Images

```bash
# Build all service images
cd services/assignment-service
docker build -t creator-matcher-assignment-service .

cd ../creator-service
docker build -t creator-matcher-creator-service .

cd ../matching-service
docker build -t creator-matcher-matching-service .

cd ../api-gateway
docker build -t creator-matcher-api-gateway .
```

### Step 2: Create ECR Repositories

```bash
# Create ECR repositories for each service
aws ecr create-repository --repository-name creator-matcher-assignment-service --region us-east-1
aws ecr create-repository --repository-name creator-matcher-creator-service --region us-east-1
aws ecr create-repository --repository-name creator-matcher-matching-service --region us-east-1
aws ecr create-repository --repository-name creator-matcher-api-gateway --region us-east-1
```

### Step 3: Push Images to ECR

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push images
docker tag creator-matcher-assignment-service:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/creator-matcher-assignment-service:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/creator-matcher-assignment-service:latest

# Repeat for other services...
```

### Step 4: Deploy ECS Infrastructure

```bash
cd deployment/aws
chmod +x deploy.sh
./deploy.sh
```

This will create:
- ECS Cluster
- Task Definitions
- IAM Roles
- CloudWatch Log Groups

### Step 5: Create ECS Services

After infrastructure is deployed, create ECS services for each container through the AWS Console or CLI.

---

## Frontend Deployment

### Option 1: AWS S3 + CloudFront (Recommended)

1. **Build the frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Create S3 bucket**
   ```bash
   aws s3 mb s3://creator-matcher-frontend --region us-east-1
   ```

3. **Upload build files**
   ```bash
   aws s3 sync build/ s3://creator-matcher-frontend --delete
   ```

4. **Configure S3 for static website hosting**
   ```bash
   aws s3 website s3://creator-matcher-frontend --index-document index.html --error-document index.html
   ```

5. **Create CloudFront distribution** (via AWS Console)
   - Origin: S3 bucket
   - Default root object: index.html
   - Error pages: Redirect 404 to /index.html

6. **Update frontend API URLs**
   
   Edit `frontend/src/App.tsx`:
   ```typescript
   const API_BASE = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/api';
   ```

### Option 2: Vercel (Easiest)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd frontend
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard**
   - `REACT_APP_API_BASE`: Your API Gateway URL

---

## Post-Deployment Configuration

### 1. Set Up MongoDB Atlas

1. Create a MongoDB Atlas cluster
2. Configure network access (allow AWS Lambda IPs or use VPC peering)
3. Create database user
4. Get connection string and update `MONGODB_URI`

### 2. Initialize Pinecone Index

```bash
# Create Pinecone index (if not exists)
curl -X POST "https://api.pinecone.io/indexes" \
  -H "Api-Key: YOUR_PINECONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "creator-embeddings",
    "dimension": 1536,
    "metric": "cosine",
    "spec": {
      "serverless": {
        "cloud": "aws",
        "region": "us-east-1"
      }
    }
  }'
```

### 3. Seed Creator Data

```bash
# Call the creator service to ingest and generate embeddings
curl -X POST https://your-creator-service-url/creators/embeddings/refresh \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'
```

### 4. Configure Custom Domain (Optional)

1. **Register domain in Route 53**
2. **Create SSL certificate in ACM**
3. **Configure API Gateway custom domain**
4. **Update DNS records**

### 5. Set Up Monitoring

1. **CloudWatch Dashboards**
   - Lambda invocations
   - Error rates
   - Duration metrics

2. **CloudWatch Alarms**
   - High error rates
   - Slow response times
   - Throttling

3. **X-Ray Tracing** (optional)
   ```bash
   # Enable X-Ray in serverless.yml
   tracing:
     lambda: true
     apiGateway: true
   ```

---

## Monitoring and Maintenance

### View Logs

```bash
# View Lambda logs
serverless logs -f createAssignment --stage dev --region us-east-1 --tail

# View CloudWatch logs
aws logs tail /aws/lambda/creator-assignment-matcher-assignment-service-dev-createAssignment --follow
```

### Monitor Performance

```bash
# Get Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=creator-assignment-matcher-assignment-service-dev-createAssignment \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### Update Deployment

```bash
# Update a single service
cd services/assignment-service
serverless deploy --stage dev --region us-east-1

# Update a single function
serverless deploy function -f createAssignment --stage dev --region us-east-1
```

### Cost Optimization

1. **Lambda**
   - Use appropriate memory settings
   - Enable warmup for frequently used functions
   - Monitor cold starts

2. **API Gateway**
   - Use caching for GET requests
   - Implement rate limiting

3. **Database**
   - Use connection pooling
   - Implement query optimization
   - Use indexes appropriately

---

## Troubleshooting

### Common Issues

#### 1. Lambda Timeout

**Symptom:** Functions timing out after 30 seconds

**Solution:**
```yaml
# In serverless.yml
functions:
  myFunction:
    timeout: 60  # Increase timeout
```

#### 2. Cold Start Issues

**Symptom:** First request is very slow

**Solution:**
- Enable warmup plugin (already configured)
- Increase memory allocation
- Use provisioned concurrency for critical functions

#### 3. MongoDB Connection Issues

**Symptom:** "MongoNetworkError" or connection timeouts

**Solution:**
- Check MongoDB Atlas network access settings
- Verify connection string
- Use connection pooling
- Consider VPC peering for better performance

#### 4. Pinecone Rate Limits

**Symptom:** "Rate limit exceeded" errors

**Solution:**
- Implement exponential backoff (already implemented)
- Batch requests appropriately
- Upgrade Pinecone plan if needed

#### 5. CORS Errors

**Symptom:** Browser shows CORS errors

**Solution:**
```yaml
# In serverless.yml
functions:
  myFunction:
    events:
      - http:
          path: /my-path
          method: post
          cors:
            origin: '*'
            headers:
              - Content-Type
              - Authorization
```

### Debug Mode

Enable verbose logging:

```bash
# Set LOG_LEVEL environment variable
serverless deploy --stage dev --region us-east-1 --verbose

# Or update in serverless.yml
environment:
  LOG_LEVEL: debug
```

### Get Help

- Check CloudWatch Logs for detailed error messages
- Review X-Ray traces for performance bottlenecks
- Check AWS Service Health Dashboard
- Review Serverless Framework documentation

---

## Cost Estimates

### Serverless (Lambda) - Typical Monthly Costs

- **Lambda**: $5-20 (1M requests, 512MB memory)
- **API Gateway**: $3.50 (1M requests)
- **MongoDB Atlas**: $25-57 (M10 shared cluster)
- **Pinecone**: $70 (Starter plan)
- **CloudWatch**: $5-10 (logs and metrics)

**Total: ~$108-162/month** for moderate usage

### Container (ECS Fargate) - Typical Monthly Costs

- **ECS Fargate**: $30-50 per service (0.25 vCPU, 0.5GB)
- **Application Load Balancer**: $16
- **MongoDB Atlas**: $25-57
- **Pinecone**: $70
- **CloudWatch**: $5-10

**Total: ~$146-203/month** for 3 services

---

## Security Best Practices

1. **Use AWS Secrets Manager** for sensitive credentials
2. **Enable VPC** for Lambda functions accessing databases
3. **Implement API authentication** (API keys, JWT, etc.)
4. **Use IAM roles** with least privilege
5. **Enable CloudTrail** for audit logging
6. **Implement rate limiting** on API Gateway
7. **Use HTTPS only** for all endpoints
8. **Regular security updates** for dependencies

---

## Next Steps

1. ✅ Deploy services to AWS
2. ✅ Configure monitoring and alerts
3. ✅ Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)
4. ✅ Implement authentication and authorization
5. ✅ Add custom domain and SSL
6. ✅ Set up staging environment
7. ✅ Implement backup and disaster recovery
8. ✅ Load testing and performance optimization

---

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review CloudWatch logs
- Contact the development team

---

**Last Updated:** February 2026
