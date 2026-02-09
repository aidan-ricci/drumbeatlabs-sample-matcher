#!/bin/bash

# Validation script for Creator Assignment Matcher setup
echo "Validating Creator Assignment Matcher setup..."

# Check required files
echo "Checking required files..."
required_files=(
    "docker-compose.yml"
    ".env"
    "frontend/Dockerfile"
    "services/api-gateway/Dockerfile"
    "services/assignment-service/Dockerfile"
    "services/creator-service/Dockerfile"
    "services/matching-service/Dockerfile"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    else
        echo "✅ Found: $file"
    fi
done

# Validate Docker Compose configuration
echo "Validating Docker Compose configuration..."
if docker-compose config --quiet; then
    echo "✅ Docker Compose configuration is valid"
else
    echo "❌ Docker Compose configuration has errors"
    exit 1
fi

# Check environment variables
echo "Checking environment configuration..."
if [ -f .env ]; then
    echo "✅ Environment file exists"
    
    # Check for critical environment variables
    if grep -q "PINECONE_API_KEY=" .env; then
        echo "✅ Pinecone API key configured"
    else
        echo "⚠️  Pinecone API key not set (required for full functionality)"
    fi
    
    if grep -q "OPENAI_API_KEY=" .env; then
        echo "✅ OpenAI API key configured"
    else
        echo "⚠️  OpenAI API key not set (required for full functionality)"
    fi
else
    echo "❌ Environment file missing"
    exit 1
fi

# Validate package.json files
echo "Validating service package.json files..."
service_dirs=(
    "services/api-gateway"
    "services/assignment-service"
    "services/creator-service"
    "services/matching-service"
)

for dir in "${service_dirs[@]}"; do
    if [ -f "$dir/package.json" ]; then
        echo "✅ $dir/package.json exists"
    else
        echo "❌ Missing $dir/package.json"
        exit 1
    fi
done

echo ""
echo "🎉 Setup validation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run 'npm run dev' to start the application"
echo "3. Access the application at http://localhost"