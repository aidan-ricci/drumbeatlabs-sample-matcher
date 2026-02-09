const fc = require('fast-check');
const assignmentHandlers = require('../handlers/assignmentHandlers');
const Assignment = require('../../../shared/models/Assignment');
const logger = require('../../../shared/utils/logger');

// Mock dependencies
jest.mock('../../../shared/models/Assignment');
jest.mock('../../../shared/utils/logger');

describe('Assignment Service Property-Based Tests', () => {
    const userIdArbitrary = fc.string({ minLength: 5 });
    const topicArbitrary = fc.string({ minLength: 1 });
    const keyTakeawayArbitrary = fc.string({ minLength: 1 });
    const additionalContextArbitrary = fc.string({ minLength: 1 });

    const assignmentDataArbitrary = fc.record({
        userId: userIdArbitrary,
        topic: topicArbitrary,
        keyTakeaway: keyTakeawayArbitrary,
        additionalContext: additionalContextArbitrary,
        status: fc.constantFrom('pending', 'processing', 'completed', 'failed'),
        creatorValues: fc.array(fc.string()),
        creatorNiches: fc.array(fc.string()),
        toneStyle: fc.string()
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Property 16: Assignment data storage and retrieval
    test('Property 16: createAssignment always returns a valid public JSON on success', async () => {
        await fc.assert(
            fc.asyncProperty(assignmentDataArbitrary, async (data) => {
                const mockSavedAssignment = {
                    ...data,
                    _id: 'mock-id',
                    toPublicJSON: jest.fn().mockReturnValue({
                        id: 'mock-id',
                        ...data
                    }),
                    save: jest.fn().mockResolvedValue({
                        _id: 'mock-id',
                        ...data,
                        toPublicJSON: jest.fn().mockReturnValue({ id: 'mock-id', ...data })
                    })
                };

                Assignment.mockImplementation(() => mockSavedAssignment);

                const result = await assignmentHandlers.createAssignment(data);

                expect(result.success).toBe(true);
                expect(result.data.id).toBe('mock-id');
                expect(result.data.topic).toBe(data.topic);
            })
        );
    });

    // Property 16: Pagination logic
    test('Property 16: getAssignmentHistory handles pagination limits and skips correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
                fc.record({
                    limit: fc.integer({ min: 1, max: 100 }),
                    skip: fc.integer({ min: 0, max: 100 })
                }),
                async (userId, options) => {
                    const mockAssignments = Array(options.limit).fill({}).map((_, i) => ({
                        id: i,
                        toPublicJSON: jest.fn().mockReturnValue({ id: i })
                    }));
                    Assignment.findByUserId.mockResolvedValue(mockAssignments);
                    Assignment.countDocuments.mockResolvedValue(500);

                    const result = await assignmentHandlers.getAssignmentHistory(userId, options);

                    expect(result.success).toBe(true);
                    expect(result.pagination.limit).toBe(options.limit);
                    expect(result.pagination.skip).toBe(options.skip);
                    expect(Assignment.findByUserId).toHaveBeenCalledWith(userId, expect.objectContaining({
                        limit: options.limit,
                        skip: options.skip
                    }));
                }
            )
        );
    });

    // Property 3: Valid form submissions trigger complete workflow (Status updates)
    test('Property 3: updateAssignmentStatus only accepts valid statuses', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string(),
                fc.string(),
                async (id, status) => {
                    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
                    const isValid = validStatuses.includes(status);

                    if (isValid) {
                        Assignment.findById.mockResolvedValue({
                            status: 'pending',
                            save: jest.fn().mockResolvedValue({
                                toPublicJSON: jest.fn().mockReturnValue({ status })
                            }),
                            toPublicJSON: jest.fn().mockReturnValue({ status })
                        });
                    }

                    const result = await assignmentHandlers.updateAssignmentStatus(id, status);

                    if (isValid) {
                        expect(result.success).toBe(true);
                        expect(result.data.status).toBe(status);
                    } else {
                        expect(result.success).toBe(false);
                        expect(result.statusCode).toBe(400);
                    }
                }
            )
        );
    });
});
