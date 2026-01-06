require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initializeSocket } = require('./socket');

const PORT = process.env.PORT || 5000;

// Handle MongoDB connection errors
function handleMongoError(error) {
  console.error('MongoDB connection error:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Handle unhandled promise rejections
function handleUnhandledRejection(err) {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Handle uncaught exceptions
function handleUncaughtException(err) {
  console.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Connect to MongoDB and start server
function startServer() {
  // Make sure MONGODB_URI is provided
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGODB_URI environment variable. Please set it before starting the server.');
    console.error('You can create a backend/.env file or set it in your environment. Example in backend/.env.example');
    // Fail fast in development so the developer notices the missing config
    process.exit(1);
  }

  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
      const server = http.createServer(app);
      initializeSocket(server);
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });

    })
    .catch(handleMongoError);

  mongoose.connection.on('error', handleMongoError);
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
}

// Only start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  handleMongoError,
  handleUnhandledRejection,
  handleUncaughtException,
  startServer
};