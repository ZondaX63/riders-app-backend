require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

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
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      // Start server
      app.listen(PORT, () => {
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