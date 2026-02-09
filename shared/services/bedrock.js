const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const logger = require('../utils/logger');

class BedrockService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.circuitBreakerState = 'CLOSED';
        this.failureCount = 0;
        this.failureThreshold = 5;
        this.resetTimeout = 30000;
        this.lastFailureTime = null;

        // Default models
        this.embeddingModelId = process.env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v1';
        this.completionModelId = process.env.BEDROCK_COMPLETION_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0';
    }

    async initialize() {
        try {
            const region = process.env.AWS_REGION || 'us-east-1';

            // Check if credentials are provided in env (SDK will also check standard paths)
            const hasCreds = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

            if (!hasCreds && process.env.NODE_ENV === 'production') {
                logger.warn('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) not found in env. Falling back to default credential provider chain.');
            }

            this.client = new BedrockRuntimeClient({
                region,
                credentials: hasCreds ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                } : undefined
            });

            // We don't test connectivity here with a real call to avoid costs/failures during build
            // But we mark as "connected" if we have a client
            this.isConnected = true;
            this.circuitBreakerState = 'CLOSED';
            this.failureCount = 0;

            logger.info('Bedrock service initialized', { region, embeddingModel: this.embeddingModelId });
            return true;
        } catch (error) {
            logger.error('Failed to initialize Bedrock service', { error: error.message });
            this.handleFailure();
            throw error;
        }
    }

    async executeWithCircuitBreaker(operation, ...args) {
        if (this.circuitBreakerState === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.circuitBreakerState = 'HALF_OPEN';
                logger.info('Bedrock circuit breaker transitioning to HALF_OPEN');
            } else {
                throw new Error('Circuit breaker is OPEN - Bedrock service unavailable');
            }
        }

        try {
            const result = await this.executeWithRetry(operation, ...args);

            if (this.circuitBreakerState === 'HALF_OPEN') {
                this.circuitBreakerState = 'CLOSED';
                this.failureCount = 0;
                logger.info('Bedrock circuit breaker reset to CLOSED');
            }

            return result;
        } catch (error) {
            this.handleFailure();
            throw error;
        }
    }

    async executeWithRetry(operation, ...args) {
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation.call(this, ...args);
            } catch (error) {
                lastError = error;

                // Handle Throttling (similar to 429)
                if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
                    const delay = Math.pow(2, attempt) * 1000;
                    logger.warn(`Bedrock rate limit hit, retrying after ${delay}ms`, { attempt });

                    if (attempt < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }

                logger.warn(`Bedrock operation failed, attempt ${attempt}/${this.maxRetries}`, {
                    error: error.message,
                    operation: operation.name
                });

                if (attempt < this.maxRetries && this.isRetryableError(error)) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }

        throw lastError;
    }

    isRetryableError(error) {
        const retryableErrors = [
            'ThrottlingException',
            'ProvisionedThroughputExceededException',
            'InternalServerException',
            'ServiceUnavailableException',
            'ECONNRESET',
            'ETIMEDOUT'
        ];
        return retryableErrors.includes(error.name) || error.code === 'ECONNRESET';
    }

    handleFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.circuitBreakerState = 'OPEN';
            logger.error('Bedrock circuit breaker opened due to repeated failures', {
                failureCount: this.failureCount,
                threshold: this.failureThreshold
            });
        }
    }

    async generateEmbedding(text) {
        if (!this.isConnected || !this.client) {
            await this.initialize();
        }

        return this.executeWithCircuitBreaker(async () => {
            const body = JSON.stringify({
                inputText: text,
            });

            const command = new InvokeModelCommand({
                modelId: this.embeddingModelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: body,
            });

            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            return responseBody.embedding;
        });
    }

    async generateEmbeddings(texts) {
        const results = [];
        const concurrencyLimit = 3;

        for (let i = 0; i < texts.length; i += concurrencyLimit) {
            const batch = texts.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(text => this.generateEmbedding(text));
            results.push(...(await Promise.all(batchPromises)));
        }

        return results;
    }

    async generateCompletion(prompt, options = {}) {
        if (!this.isConnected || !this.client) {
            await this.initialize();
        }

        const modelId = options.model || this.completionModelId;

        return this.executeWithCircuitBreaker(async () => {
            let body;

            if (modelId.includes('claude')) {
                body = JSON.stringify({
                    anthropic_version: 'bedrock-2023-05-31',
                    max_tokens: options.maxTokens || 500,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: options.temperature || 0.7,
                });
            } else {
                body = JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: options.maxTokens || 500,
                        temperature: options.temperature || 0.7,
                    }
                });
            }

            const command = new InvokeModelCommand({
                modelId: modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: body,
            });

            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            if (modelId.includes('claude')) {
                return responseBody.content[0].text;
            } else {
                return responseBody.results[0].outputText;
            }
        });
    }

    getHealthStatus() {
        return {
            connected: this.isConnected,
            circuitBreakerState: this.circuitBreakerState,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            configured: !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION),
            region: process.env.AWS_REGION || 'us-east-1'
        };
    }

    async disconnect() {
        this.isConnected = false;
        this.client = null;
        logger.info('Bedrock service disconnected');
    }
}

module.exports = new BedrockService();
