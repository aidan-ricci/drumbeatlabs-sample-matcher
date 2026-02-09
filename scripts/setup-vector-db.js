const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// Manual .env loading
if (fs.existsSync(envPath)) {
    console.log(`Loading .env from ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const lineTrimmed = line.trim();
        if (!lineTrimmed || lineTrimmed.startsWith('#')) return;

        const match = lineTrimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // strip quotes
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
} else {
    console.warn('.env file not found!');
}

try {
    const pineconeService = require(path.join(rootDir, 'shared', 'services', 'pinecone.js'));

    async function setup() {
        console.log('Initializing Pinecone Service...');
        try {
            // This will create the index if it doesn't exist
            await pineconeService.initialize();

            console.log('✅ Pinecone Index Verified/Created!');

            // Get stats to confirm
            try {
                const stats = await pineconeService.getIndexStats();
                console.log('Index Stats:', JSON.stringify(stats, null, 2));
            } catch (statError) {
                console.warn('Could not retrieve stats (might be still initializing):', statError.message);
            }

            process.exit(0);
        } catch (error) {
            console.error('❌ Failed to initialize Pinecone:', error);
            process.exit(1);
        }
    }

    setup();
} catch (error) {
    console.error('Failed to load pinecone service. Ensure dependencies in "shared" are installed.', error);
    process.exit(1);
}
