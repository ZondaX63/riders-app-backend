const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

// Verify environment variables
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set in test environment');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in test environment');
  process.exit(1);
}

const { connectDB, closeDB, clearDB } = require('./db');

// Set test environment
process.env.NODE_ENV = 'test';

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

// Global setup
beforeAll(async () => {
  await connectDB();
});

// Clear the database after each test
afterEach(async () => {
  await clearDB();
});

// Global teardown
afterAll(async () => {
  await closeDB();
}); 