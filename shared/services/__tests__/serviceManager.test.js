// Mock AWS SDK before requiring serviceManager (virtual mock for non-existent module)
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  InvokeModelCommand: jest.fn()
}), { virtual: true });

const serviceManager = require('../serviceManager');

// Mock environment variables for testing
process.env.PINECONE_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';

describe('ServiceManager', () => {
  beforeEach(() => {
    // Reset the service manager state
    serviceManager.initialized = false;
    serviceManager.initializationPromise = null;
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await serviceManager.gracefulShutdown();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('initialization', () => {
    test('should have initialization method', () => {
      expect(serviceManager).toBeDefined();
      expect(typeof serviceManager.initialize).toBe('function');
      expect(typeof serviceManager.isInitialized).toBe('function');
    });

    test('should provide convenience methods', () => {
      expect(typeof serviceManager.generateEmbedding).toBe('function');
      expect(typeof serviceManager.generateEmbeddings).toBe('function');
      expect(typeof serviceManager.queryVectors).toBe('function');
      expect(typeof serviceManager.upsertVectors).toBe('function');
      expect(typeof serviceManager.generateCompletion).toBe('function');
    });

    test('should handle graceful shutdown', async () => {
      expect(typeof serviceManager.gracefulShutdown).toBe('function');
    });
  });

  describe('health monitoring', () => {
    test('should provide overall health status', async () => {
      const overallHealth = await serviceManager.getOverallHealth();
      expect(overallHealth).toBeDefined();
      expect(overallHealth).toHaveProperty('initialized');
      expect(overallHealth).toHaveProperty('aiProvider');
    });

    test('should track initialization state', () => {
      const isInit = serviceManager.isInitialized();
      expect(typeof isInit).toBe('boolean');
    });
  });
});