module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
  errorOnDeprecated: true,
  bail: 1, // Stop after first failing test
  maxWorkers: 1, // Run tests serially
  globals: {
    'NODE_ENV': 'test'
  }
}; 