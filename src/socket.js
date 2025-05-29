const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.user._id);

    // Join group chat
    socket.on('joinGroup', ({ groupId }) => {
      socket.join(groupId);
      socket.to(groupId).emit('userJoined', {
        userId: socket.user._id,
        username: socket.user.username
      });
    });

    // Leave group chat
    socket.on('leaveGroup', ({ groupId }) => {
      socket.leave(groupId);
      socket.to(groupId).emit('userLeft', {
        userId: socket.user._id,
        username: socket.user.username
      });
    });

    // Typing indicator
    socket.on('typing', ({ groupId, isTyping }) => {
      socket.to(groupId).emit('typing', {
        userId: socket.user._id,
        username: socket.user.username,
        isTyping
      });
    });

    // Location sharing
    socket.on('shareLocation', ({ groupId, location }) => {
      socket.to(groupId).emit('locationShared', {
        userId: socket.user._id,
        username: socket.user.username,
        location
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user._id);
      io.emit('userDisconnected', {
        userId: socket.user._id,
        username: socket.user.username
      });
    });
  });

  return io;
};

module.exports = { initializeSocket }; 