// scripts/test-matching-rules.js
const request = require('supertest');
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

const assignmentWithRules = {
    topic: 'DIY Home Renovation',
    keyTakeaway: 'Easy fixes for homeowners',
    additionalContext: 'Looking for practical guides',
    // Rule-based filters that match "Dani M." (homefixhacks)
    creatorNiches: ['Home Improvement', 'DIY'],
    creatorValues: ['Sustainability', 'Practicality'],
    targetAudience: {
        locale: 'CA',
        demographic: 'Homeowners'
    }
};

async function test() {
    console.log('🧪 Testing Rule-Based Matching Logic...');

    try {
        const res = await request(GATEWAY_URL).post('/api/matches').send({ assignment: assignmentWithRules });

        if (res.status === 200 || res.status === 201) {
            console.log('✅ Match Request Successful');
            const matches = res.body.data.matches;

            if (matches && matches.length > 0) {
                const topMatch = matches[0];
                console.log('\n🏆 Top Match:', topMatch.creator.nickname);
                console.log('----------------------------------------');
                console.log('Total Score:', topMatch.matchScore);
                console.log('Score Breakdown:', topMatch.scoreBreakdown);

                // Assertions for visual feedback
                const breakdown = topMatch.scoreBreakdown;
                if (breakdown.nicheAlignment > 0.5) console.log('✅ Niche Rule: Active (> 0.5)');
                else console.log('❌ Niche Rule: Inactive/Low');

                if (breakdown.valueAlignment > 0.5) console.log('✅ Value Rule: Active (> 0.5)');
                else console.log('❌ Value Rule: Inactive/Low');

                if (breakdown.audienceMatch > 0.5) console.log('✅ Audience Rule: Active (> 0.5)');
                else console.log('❌ Audience Rule: Inactive/Low');

            } else {
                console.warn('⚠️ No matches found.');
            }
        } else {
            console.error('❌ Request failed:', res.status, res.body);
        }
    } catch (e) {
        console.error('❌ Test failed:', e.message);
    }
}

test();
