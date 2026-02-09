const assignmentHandlers = require('../handlers/assignmentHandlers');

// Mock the logger to avoid console output during tests
jest.mock('../../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock mongoose to avoid database connection issues in tests
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    close: jest.fn(),
    readyState: 1
  }
}));

// Mock the Assignment model
const mockAssignment = {
  save: jest.fn(),
  toPublicJSON: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  countDocuments: jest.fn(),
  searchAssignments: jest.fn(),
  getAssignmentStats: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn(),
  findByIdAndDelete: jest.fn()
};

jest.mock('../../../shared/models/Assignment', () => {
  return jest.fn().mockImplementation(() => mockAssignment);
});

describe('Assignment Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssignment', () => {
    it('should create a new assignment successfully', async () => {
      const assignmentData = {
        topic: 'Test Topic',
        keyTakeaway: 'Test takeaway',
        additionalContext: 'Test context',
        userId: 'test-user-123'
      };

      const mockSavedAssignment = {
        _id: 'mock-id',
        ...assignmentData,
        status: 'pending',
        createdAt: new Date(),
        toPublicJSON: jest.fn().mockReturnValue({
          id: 'mock-id',
          ...assignmentData,
          status: 'pending'
        })
      };

      mockAssignment.save.mockResolvedValue(mockSavedAssignment);

      const result = await assignmentHandlers.createAssignment(assignmentData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        topic: '', // Empty topic should fail validation
        keyTakeaway: 'Test takeaway',
        additionalContext: 'Test context'
      };

      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = {
        topic: {
          path: 'topic',
          message: 'Topic is required'
        }
      };

      mockAssignment.save.mockRejectedValue(validationError);

      const result = await assignmentHandlers.createAssignment(invalidData);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe('Validation failed');
    });
  });

  describe('searchAssignments', () => {
    it('should validate search term', async () => {
      const result = await assignmentHandlers.searchAssignments('');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe('Search term is required');
    });

    it('should search assignments successfully', async () => {
      const mockResults = [
        {
          topic: 'Fashion trends',
          _id: '1',
          toPublicJSON: jest.fn().mockReturnValue({ id: '1', topic: 'Fashion trends' })
        },
        {
          topic: 'Sustainable fashion',
          _id: '2',
          toPublicJSON: jest.fn().mockReturnValue({ id: '2', topic: 'Sustainable fashion' })
        }
      ];

      // Mock the Assignment model's static method
      const Assignment = require('../../../shared/models/Assignment');
      Assignment.searchAssignments = jest.fn().mockResolvedValue(mockResults);

      const result = await assignmentHandlers.searchAssignments('fashion');

      expect(result.success).toBe(true);
      expect(result.searchTerm).toBe('fashion');
    });
  });
});