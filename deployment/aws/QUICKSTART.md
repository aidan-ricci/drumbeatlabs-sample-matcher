# Quick Start: AWS Deployment

Get your Creator Assignment Matcher deployed to AWS in under 15 minutes!

## Prerequisites Checklist

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Node.js v18+ installed
- [ ] Serverless Framework installed (`npm install -g serverless`)
- [ ] MongoDB Atlas account (or MongoDB URI)
- [ ] Pinecone API key
- [ ] OpenAI API key

## Step-by-Step Deployment

### 1. Set Environment Variables (2 minutes)

Create a `.env` file in the project root:

```bash
# Copy the example
cp .env.example .env

# Edit with your credentials
nano .env
```

Required variables:
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/creator-matcher
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=creator-embeddings
OPENAI_API_KEY=your-openai-key
```

### 2. Install Dependencies (3 minutes)

```bash
# Install shared dependencies
cd shared && npm install && cd ..

# Install service dependencies
cd services/assignment-service && npm install && cd ../..
cd services/creator-service && npm install && cd ../..
cd services/matching-service && npm install && cd ../..
```

### 3. Deploy to AWS (5-10 minutes)

```bash
cd deployment/aws

# Deploy all services to dev environment
./deploy-serverless.sh dev us-east-1
```

The script will:
- ✅ Check prerequisites
- ✅ Validate environment variables
- ✅ Deploy all three microservices
- ✅ Display API endpoints

### 4. Initialize Creator Data (2 minutes)

After deployment, seed the creator database:

```bash
# Get your creator service endpoint from the deployment output
CREATOR_SERVICE_URL="https://your-creator-service-url.execute-api.us-east-1.amazonaws.com/dev"

# Trigger embedding generation
curl -X POST "$CREATOR_SERVICE_URL/creators/embeddings/refresh" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'
```

### 5. Test the Deployment (1 minute)

```bash
# Test health endpoints
curl https://your-assignment-service-url/health
curl https://your-creator-service-url/health
curl https://your-matching-service-url/health

# Test matching
curl -X POST https://your-matching-service-url/matches \
  -H "Content-Type: application/json" \
  -d '{
    "assignment": {
      "topic": "Financial literacy for young adults",
      "keyTakeaway": "Budgeting basics",
      "additionalContext": "Focus on practical tips"
    }
  }'
```

### 6. Deploy Frontend (Optional, 3 minutes)

#### Option A: Vercel (Easiest)

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Set environment variable in Vercel dashboard:
- `REACT_APP_API_BASE`: Your matching service URL

#### Option B: AWS S3 + CloudFront

```bash
cd frontend
npm install
npm run build

# Create S3 bucket
aws s3 mb s3://creator-matcher-frontend

# Upload files
aws s3 sync build/ s3://creator-matcher-frontend --delete

# Configure static website hosting
aws s3 website s3://creator-matcher-frontend \
  --index-document index.html \
  --error-document index.html
```

## Verification

Your deployment is successful if:

1. ✅ All three services show "healthy" status
2. ✅ Creator embeddings are generated (check logs)
3. ✅ Test matching request returns 3 creators
4. ✅ Frontend loads and can submit assignments

## Common Issues

### Issue: "AWS credentials not configured"
**Solution:** Run `aws configure` and enter your credentials

### Issue: "Missing environment variables"
**Solution:** Ensure `.env` file exists with all required variables

### Issue: "Deployment failed"
**Solution:** Check CloudWatch logs:
```bash
serverless logs -f createAssignment --stage dev --region us-east-1 --tail
```

### Issue: "MongoDB connection failed"
**Solution:** 
- Verify MongoDB Atlas network access allows AWS IPs
- Check connection string format
- Ensure database user has correct permissions

## Next Steps

1. **Set up monitoring**: Configure CloudWatch alarms
2. **Add authentication**: Implement API keys or JWT
3. **Custom domain**: Configure Route 53 and ACM
4. **CI/CD**: Set up GitHub Actions for automated deployments
5. **Staging environment**: Deploy to staging with `./deploy-serverless.sh staging`

## Useful Commands

```bash
# View logs
serverless logs -f functionName --stage dev --region us-east-1 --tail

# Update single service
cd services/assignment-service
serverless deploy --stage dev --region us-east-1

# Remove deployment
cd deployment/aws
./undeploy-serverless.sh dev us-east-1

# Check deployment status
serverless info --stage dev --region us-east-1
```

## Cost Estimate

For moderate usage (~10K requests/month):
- Lambda: ~$5
- API Gateway: ~$3.50
- MongoDB Atlas: ~$25 (M10 cluster)
- Pinecone: ~$70 (Starter)
- **Total: ~$103.50/month**

## Support

- 📖 Full documentation: `deployment/aws/README.md`
- 🐛 Issues: Check CloudWatch logs
- 💬 Questions: Contact development team

---

**Deployment Time:** ~15 minutes  
**Difficulty:** Easy  
**Cost:** ~$100/month
