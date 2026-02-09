# Drumbeat Labs - Test Suite

This directory contains comprehensive property-based and unit tests for the Drumbeat Labs Creator Matcher application.

## Test Structure

```
tests/
├── api-integration.test.js      # API integration and resilience tests
├── error-handling.test.js       # Error logging and handling tests
├── performance.test.js          # Performance and optimization tests
├── scalability.test.js          # Horizontal scaling and load tests
├── structure.test.js            # Project structure validation
└── package.json                 # Test configuration

shared/
├── validation/__tests__/
│   └── validation.test.js       # Data validation property tests
└── database/__tests__/
    ├── backup.test.js           # Backup and recovery tests
    └── retention.test.js        # Data retention policy tests

services/assignment-service/__tests__/
├── assignmentHandlers.test.js   # Unit tests for handlers
└── assignmentProperties.test.js # Property-based tests

frontend/src/__tests__/
└── ui-properties.test.js        # Frontend UI property tests
```

## Running Tests

### Install Dependencies
```bash
cd tests
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Property-based tests only
npm run test:properties

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit

# All test suites sequentially
npm run test:all
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### End-to-End (E2E) Smoke Tests
Running these tests requires Docker and Docker Compose.
```bash
# Run from project root
./scripts/test-e2e.sh
```
This script will:
1. Start all services using Docker Compose
2. Wait for services to be healthy
3. Run integration tests against the running services
4. Report pass/fail status

## Property-Based Testing

This test suite uses [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. Property-based tests validate that certain properties hold true across a wide range of randomly generated inputs.

### Key Properties Tested

1. **Form Validation** - Empty fields prevent submission, valid data enables it
2. **Loading States** - Prevent duplicate submissions during async operations
3. **Workflow Completion** - Valid submissions trigger complete processing
4. **Error Messages** - User-friendly error display
5. **Results Display** - Proper sorting and limiting of match results
6. **Responsive Design** - Layout adapts to screen sizes
7. **API Integration** - Fallback mechanisms and retry logic
8. **Performance** - Response times under threshold
9. **Data Retention** - TTL indexes and cleanup
10. **Error Logging** - Comprehensive context and redaction
11. **Backup/Recovery** - Integrity and point-in-time recovery
12. **Scalability** - Stateless design and load distribution

## Coverage Thresholds

The test suite enforces minimum coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## CI/CD Integration

These tests are designed to run in CI/CD pipelines. Add to your workflow:

```yaml
- name: Run Tests
  run: |
    cd tests
    npm install
    npm run test:all
    npm run test:coverage
```

## Writing New Tests

### Property-Based Test Example
```javascript
const fc = require('fast-check');

test('Property: Valid data always passes validation', () => {
    fc.assert(
        fc.property(
            fc.record({ /* your arbitraries */ }),
            (data) => {
                const result = validate(data);
                expect(result.isValid).toBe(true);
            }
        )
    );
});
```

### Unit Test Example
```javascript
test('createAssignment returns success on valid input', async () => {
    const result = await createAssignment(validData);
    expect(result.success).toBe(true);
});
```

## Troubleshooting

### Tests Failing Due to Missing Dependencies
```bash
npm install fast-check jest --save-dev
```

### MongoDB Connection Issues
Ensure MongoDB is running or mock the database connection in tests.

### Environment Variables
Create a `.env.test` file with test-specific configuration.

## Contributing

When adding new features:
1. Write property-based tests for invariants
2. Write unit tests for specific behaviors
3. Ensure coverage thresholds are met
4. Run the full test suite before committing
