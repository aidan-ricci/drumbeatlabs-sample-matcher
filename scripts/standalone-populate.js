const fs = require('fs');
const path = require('path');

// Helper to resolve modules from shared directory
const sharedModules = path.resolve(__dirname, '../shared/node_modules');

// Manual .env loading
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    });
}

// Require dependencies from shared modules
const { BedrockRuntimeClient, InvokeModelCommand } = require(path.join(sharedModules, '@aws-sdk/client-bedrock-runtime'));
const { Pinecone } = require(path.join(sharedModules, '@pinecone-database/pinecone'));

const REGION = process.env.AWS_REGION || 'us-east-1';
const EMBEDDING_MODEL = process.env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v1';
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'creator-embeddings';

async function main() {
    console.log('🚀 Starting Standalone Population...');
    console.log(`Region: ${REGION}`);
    console.log(`Model: ${EMBEDDING_MODEL}`);
    console.log(`Index: ${INDEX_NAME}`);

    // 1. Load Creators
    const creatorsPath = path.join(__dirname, '../creators.json');
    if (!fs.existsSync(creatorsPath)) {
        throw new Error(`creators.json not found at ${creatorsPath}`);
    }
    const creators = JSON.parse(fs.readFileSync(creatorsPath, 'utf8'));
    const creatorList = Array.isArray(creators) ? creators : Object.values(creators);
    console.log(`Loaded ${creatorList.length} creators.`);

    // 2. Init Bedrock
    const bedrock = new BedrockRuntimeClient({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });

    // 3. Init Pinecone
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME);

    // 4. Generate & Upsert
    const vectors = [];
    console.log('Generating embeddings...');

    for (const creator of creatorList) {
        const text = `${creator.bio} Niches: ${creator.analysis?.primaryNiches?.join(', ')} Values: ${creator.analysis?.apparentValues?.join(', ')}`;

        try {
            const command = new InvokeModelCommand({
                modelId: EMBEDDING_MODEL,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({ inputText: text })
            });
            const response = await bedrock.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const embedding = responseBody.embedding;

            vectors.push({
                id: creator.uniqueId,
                values: embedding,
                metadata: {
                    nickname: creator.nickname,
                    bio: creator.bio,
                    followerCount: creator.followerCount,
                    // Add other useful metadata
                    region: creator.region,
                    primaryNiches: creator.analysis?.primaryNiches || []
                }
            });
            process.stdout.write('.');
        } catch (e) {
            console.error(`\nFailed to generate embedding for ${creator.nickname}:`, e.message);
        }
    }
    console.log(); // Newline

    if (vectors.length > 0) {
        console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
        // Upsert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            await index.upsert(batch);
            console.log(`Upserted batch ${i / batchSize + 1}`);
        }
        console.log('✅ Population Complete!');
    } else {
        console.warn('No vectors generated.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
