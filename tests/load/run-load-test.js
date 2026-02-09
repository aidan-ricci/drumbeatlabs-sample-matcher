const autocannon = require('autocannon');

const target = process.env.TARGET_URL || 'http://localhost:3000';

if (!process.env.TARGET_URL) {
    console.log(`No TARGET_URL provided, defaulting to ${target}`);
}

async function runScenario(name, options) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Running scenario: ${name}`);
    console.log(`--------------------------------------------------`);

    return new Promise((resolve, reject) => {
        const instance = autocannon({
            url: target,
            connections: 10,
            pipelining: 1,
            duration: 10,
            ...options
        }, (err, result) => {
            if (err) return reject(err);

            // Basic reporting
            console.log(`\n✅ ${name} Completed`);
            console.log(`Stats:`);
            console.log(`- Requests/sec: ${result.requests.average}`);
            console.log(`- Latency (avg): ${result.latency.average} ms`);
            console.log(`- Latency (p99): ${result.latency.p99} ms`);
            console.log(`- Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
            console.log(`- Errors: ${result.errors}`);
            console.log(`- Timeouts: ${result.timeouts}`);
            console.log(`- Non-2xx responses: ${result.non2xx}`);
            resolve(result);
        });

        autocannon.track(instance, { renderProgressBar: true });
    });
}

async function main() {
    console.log(`🚀 Starting Load Tests against ${target}`);
    console.log(`Ensuring services are warmed up...`);

    try {
        // 1. Read heavy load: Get Creators
        // Checks API Gateway -> Creator Service -> Mongo read performance
        await runScenario('Get Creators (Read Heavy)', {
            method: 'GET',
            path: '/api/creators?limit=10',
            connections: 50, // 50 concurrent users
            duration: 15     // 15 seconds
        });

        // 2. Write load: Create Assignment
        // Checks API Gateway -> Assignment Service -> Mongo write performance
        await runScenario('Create Assignment (Write)', {
            method: 'POST',
            path: '/api/assignments',
            body: JSON.stringify({
                topic: 'Load Test Topic',
                keyTakeaway: 'Testing performance under load',
                additionalContext: 'Autocannon run'
            }),
            headers: { 'content-type': 'application/json' },
            connections: 20, // 20 concurrent writes
            duration: 10     // 10 seconds
        });

        // 3. Mixed Load (Health Checks)
        // High throughput check on lightweight endpoints
        await runScenario('System Health (High Throughput)', {
            method: 'GET',
            path: '/health', // Gateway health
            connections: 100,
            duration: 10
        });

        console.log(`\n🎉 All Load Scenarios Completed!`);

    } catch (err) {
        console.error('❌ Load test failed:', err);
        process.exit(1);
    }
}

main();
