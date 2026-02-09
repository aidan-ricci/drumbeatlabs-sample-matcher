// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('creator-assignment-matcher');

// Create collections with proper indexing
db.createCollection('assignments');
db.createCollection('users');

// Create indexes for assignments collection
db.assignments.createIndex({ "userId": 1 });
db.assignments.createIndex({ "createdAt": -1 });
db.assignments.createIndex({ "topic": "text", "keyTakeaway": "text", "additionalContext": "text" });

// Create indexes for users collection
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

print('Database initialization completed successfully');