const logger = require('./shared/utils/logger');

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

async function runE2ETests() {
    logger.info('Starting E2E workflow validation...');

    try {
        // 1. Health check
        logger.info('Step 1: Checking API Gateway health...');
        const healthResponse = await fetch(`${API_GATEWAY_URL}/health`);
        const health = await healthResponse.json();
        if (health.status !== 'healthy') throw new Error('Gateway unhealthy');
        logger.info('✅ Gateway is healthy');

        // 2. Submit assignment
        logger.info('Step 2: Submitting new assignment...');
        const assignment = {
            topic: 'Future of AI in Web Development',
            keyTakeaway: 'AI agents will revolutionize how we write code and build applications.',
            additionalContext: 'Looking for creators who focus on developer tools and productivity.',
            targetAudience: {
                demographic: 'Software Engineers',
                locale: 'EN'
            },
            creatorNiches: ['Tech', 'AI', 'SaaS'],
            creatorValues: ['Innovation', 'Efficiency'],
            userId: 'test-user'
        };

        const submitResponse = await fetch(`${API_GATEWAY_URL}/api/assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assignment)
        });
        const submitData = await submitResponse.json();
        logger.debug('Assignment submit response', { submitData });
        const assignmentId = submitData.data?.id;
        if (!assignmentId) throw new Error(`Failed to get assignment ID. Response: ${JSON.stringify(submitData)}`);
        logger.info('✅ Assignment created', { assignmentId });

        // 3. Trigger matching
        logger.info('Step 3: Triggering creator matching...');
        const matchResponse = await fetch(`${API_GATEWAY_URL}/api/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignment, assignmentId })
        });
        const matchData = await matchResponse.json();

        if (!matchData.success || matchData.data.matches.length === 0) {
            throw new Error('Matching failed or returned no results');
        }
        logger.info('✅ Matching complete', {
            matchCount: matchData.data.matches.length,
            isFallback: matchData.data.isFallback
        });

        // 4. Retrieve history
        logger.info('Step 4: Verifying assignment history...');
        const historyResponse = await fetch(`${API_GATEWAY_URL}/api/assignments/history/test-user`);
        const historyData = await historyResponse.json();
        logger.debug('FULL HISTORY DATA', { historyData });
        try {
            logger.debug('History data items', { count: historyData.data?.length });
            if (historyData.data) {
                historyData.data.forEach((item, index) => {
                    logger.debug(`History item ${index}`, { id: item.id, type: typeof item.id });
                });
            }
        } catch (e) {
            logger.error('Failed to log history items', { historyData });
        }
        logger.debug('Looking for assignmentId', { assignmentId, type: typeof assignmentId });
        const found = historyData.data?.find(a => a.id === assignmentId);
        if (!found) throw new Error('Assignment not found in history');

        if (!found.matchResults || found.matchResults.length === 0) {
            throw new Error('Match results were not persisted to the assignment history');
        }
        logger.info('✅ History verified with persisted matches');

        logger.info('🎉 E2E Tests Passed Successfully!');
    } catch (error) {
        logger.error('❌ E2E Test Failed:', {
            message: error.message
        });
        process.exit(1);
    }
}

runE2ETests();
