# AWS Deployment Checklist

Use this checklist to ensure a smooth deployment to AWS.

## Pre-Deployment

### Environment Setup
- [ ] AWS CLI installed and configured
- [ ] Node.js v18+ installed
- [ ] Serverless Framework installed globally
- [ ] AWS credentials configured (`aws sts get-caller-identity` works)
- [ ] Correct AWS region selected (default: us-east-1)

### External Services
- [ ] MongoDB Atlas cluster created
- [ ] MongoDB database user created with read/write permissions
- [ ] MongoDB network access configured (allow AWS IPs or 0.0.0.0/0)
- [ ] MongoDB connection string obtained
- [ ] Pinecone account created
- [ ] Pinecone API key obtained
- [ ] Pinecone index created (name: creator-embeddings, dimension: 1536, metric: cosine)
- [ ] OpenAI API key obtained
- [ ] OpenAI account has sufficient credits

### Environment Variables
- [ ] `.env` file created in project root
- [ ] `MONGODB_URI` set correctly
- [ ] `PINECONE_API_KEY` set correctly
- [ ] `PINECONE_INDEX_NAME` set correctly
- [ ] `OPENAI_API_KEY` set correctly
- [ ] `.env` file added to `.gitignore`

### Code Preparation
- [ ] All dependencies installed in `shared/`
- [ ] All dependencies installed in `services/assignment-service/`
- [ ] All dependencies installed in `services/creator-service/`
- [ ] All dependencies installed in `services/matching-service/`
- [ ] All tests passing locally
- [ ] Code committed to version control

## Deployment

### Backend Services
- [ ] Navigate to `deployment/aws/`
- [ ] Make deployment script executable (`chmod +x deploy-serverless.sh`)
- [ ] Run deployment script (`./deploy-serverless.sh dev us-east-1`)
- [ ] All three services deployed successfully
- [ ] API Gateway endpoints received for each service
- [ ] Health check endpoints responding (200 OK)

### Service Verification
- [ ] Assignment Service health check passes
- [ ] Creator Service health check passes
- [ ] Matching Service health check passes
- [ ] CloudWatch log groups created for each service
- [ ] Lambda functions visible in AWS Console

### Data Initialization
- [ ] Creator data file (`creators.json`) exists and is valid
- [ ] Embeddings refresh endpoint called successfully
- [ ] Pinecone index populated with creator vectors
- [ ] MongoDB collections created (assignments, etc.)
- [ ] Sample assignment created successfully

### Frontend Deployment
- [ ] Frontend built successfully (`npm run build`)
- [ ] API_BASE URL updated to point to deployed services
- [ ] Frontend deployed to hosting platform (S3/CloudFront or Vercel)
- [ ] Frontend accessible via public URL
- [ ] CORS configured correctly on backend
- [ ] Frontend can communicate with backend services

## Post-Deployment

### Testing
- [ ] Create test assignment via frontend
- [ ] Verify matching returns 3 creators
- [ ] Check match scores and reasoning
- [ ] Test with different assignment types
- [ ] Verify error handling (invalid inputs, etc.)
- [ ] Test fallback mode (if Pinecone unavailable)

### Monitoring Setup
- [ ] CloudWatch dashboard created
- [ ] CloudWatch alarms configured:
  - [ ] High error rate alarm
  - [ ] High latency alarm
  - [ ] Throttling alarm
- [ ] Log retention period set (7-30 days)
- [ ] SNS topic created for alerts
- [ ] Email notifications configured

### Security
- [ ] API Gateway rate limiting configured
- [ ] Lambda function permissions reviewed (least privilege)
- [ ] Environment variables not exposed in logs
- [ ] HTTPS enforced on all endpoints
- [ ] CORS configured with appropriate origins
- [ ] MongoDB IP whitelist reviewed
- [ ] Secrets stored in AWS Secrets Manager (optional but recommended)

### Performance Optimization
- [ ] Lambda memory sizes optimized
- [ ] Lambda timeout values appropriate
- [ ] Warmup plugin configured and working
- [ ] Connection pooling enabled for MongoDB
- [ ] Pinecone query performance acceptable (<200ms)
- [ ] OpenAI API rate limits understood

### Documentation
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Troubleshooting guide created
- [ ] Team members trained on deployment process

## Production Readiness

### Staging Environment
- [ ] Staging environment deployed (`./deploy-serverless.sh staging`)
- [ ] Staging tested with production-like data
- [ ] Load testing performed on staging
- [ ] Performance benchmarks met

### Backup and Recovery
- [ ] MongoDB backup strategy defined
- [ ] Pinecone index backup strategy defined
- [ ] Disaster recovery plan documented
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined

### CI/CD (Optional but Recommended)
- [ ] GitHub Actions workflow created
- [ ] Automated tests run on PR
- [ ] Automated deployment to staging on merge to develop
- [ ] Manual approval required for production deployment
- [ ] Rollback procedure defined

### Cost Management
- [ ] AWS Budget created
- [ ] Cost alerts configured
- [ ] Resource tagging strategy implemented
- [ ] Cost optimization opportunities identified
- [ ] Monthly cost estimate documented

### Compliance and Legal
- [ ] Data privacy requirements met
- [ ] GDPR compliance verified (if applicable)
- [ ] Terms of service updated
- [ ] Privacy policy updated
- [ ] User consent mechanisms in place

## Go-Live

### Final Checks
- [ ] All checklist items above completed
- [ ] Stakeholders notified of go-live date
- [ ] Support team briefed
- [ ] Monitoring dashboard accessible to team
- [ ] Incident response plan in place
- [ ] Communication plan for issues

### Launch
- [ ] DNS updated to point to production
- [ ] SSL certificate valid and configured
- [ ] Custom domain working (if applicable)
- [ ] Frontend cache cleared
- [ ] Initial user testing successful
- [ ] Monitoring active and alerts working

### Post-Launch
- [ ] Monitor for first 24 hours
- [ ] Check error rates and latency
- [ ] Verify user feedback
- [ ] Document any issues encountered
- [ ] Schedule post-mortem meeting

## Maintenance

### Regular Tasks
- [ ] Weekly: Review CloudWatch metrics
- [ ] Weekly: Check error logs
- [ ] Monthly: Review and optimize costs
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Security audit
- [ ] Quarterly: Performance review

### Updates
- [ ] Process for deploying updates defined
- [ ] Zero-downtime deployment strategy
- [ ] Rollback procedure tested
- [ ] Version tagging strategy in place

---

## Quick Reference

### Deployment Commands
```bash
# Deploy all services
cd deployment/aws
./deploy-serverless.sh dev us-east-1

# Deploy single service
cd services/assignment-service
serverless deploy --stage dev --region us-east-1

# View logs
serverless logs -f createAssignment --stage dev --tail

# Remove deployment
cd deployment/aws
./undeploy-serverless.sh dev us-east-1
```

### Health Check URLs
```bash
# Assignment Service
curl https://[assignment-service-url]/health

# Creator Service
curl https://[creator-service-url]/health

# Matching Service
curl https://[matching-service-url]/health
```

### Emergency Contacts
- AWS Support: [Your AWS Support Plan]
- MongoDB Atlas Support: [Your MongoDB Support]
- Pinecone Support: support@pinecone.io
- OpenAI Support: help.openai.com

---

**Last Updated:** February 2026  
**Version:** 1.0  
**Owner:** [Your Team Name]
