const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { initializeSocket } = require('../src/socket');
const User = require('../src/models/User');

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockSocket = {
    on: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    broadcast: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    },
    handshake: {
      auth: {}
    }
  };

  const mockServer = {
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServer)
  };
});

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

// Mock User model
jest.mock('../src/models/User', () => ({
  findById: jest.fn()
}));

describe('Socket.IO Tests', () => {
  let mockServer;
  let mockSocket;
  let mockUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock server
    mockServer = new Server();
    mockSocket = {
      on: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      broadcast: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      },
      handshake: {
        auth: {}
      }
    };

    // Create mock user
    mockUser = {
      _id: 'user123',
      username: 'testuser',
      email: 'test@example.com'
    };

    // Setup default mock implementations
    jwt.verify.mockImplementation((token, secret, callback) => {
      if (token === 'valid-token') {
        callback(null, { userId: mockUser._id });
      } else {
        callback(new Error('Invalid token'));
      }
    });

    User.findById.mockResolvedValue(mockUser);

    // Initialize socket with mock server
    initializeSocket(mockServer);
  });

  describe('Authentication', () => {
    it('should authenticate user with valid token', async () => {
      // Simulate connection with valid token
      mockSocket.handshake.auth.token = 'valid-token';
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(mockUser._id);
    });

    it('should reject connection without token', async () => {
      // Simulate connection without token
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Authentication token required' });
    });

    it('should reject connection with invalid token', async () => {
      // Simulate connection with invalid token
      mockSocket.handshake.auth.token = 'invalid-token';
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Invalid token' });
    });
  });

  describe('Group Chat Events', () => {
    beforeEach(async () => {
      // Authenticate socket first
      mockSocket.handshake.auth.token = 'valid-token';
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);
    });

    it('should handle joining a group chat', () => {
      // Get the join handler
      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'joinGroup')[1];
      
      // Call join handler
      joinHandler({ groupId: 'group123' });

      expect(mockSocket.join).toHaveBeenCalledWith('group123');
      expect(mockSocket.to).toHaveBeenCalledWith('group123');
      expect(mockSocket.emit).toHaveBeenCalledWith('userJoined', {
        userId: mockUser._id,
        username: mockUser.username
      });
    });

    it('should handle leaving a group chat', () => {
      // Get the leave handler
      const leaveHandler = mockSocket.on.mock.calls.find(call => call[0] === 'leaveGroup')[1];
      
      // Call leave handler
      leaveHandler({ groupId: 'group123' });

      expect(mockSocket.leave).toHaveBeenCalledWith('group123');
      expect(mockSocket.to).toHaveBeenCalledWith('group123');
      expect(mockSocket.emit).toHaveBeenCalledWith('userLeft', {
        userId: mockUser._id,
        username: mockUser.username
      });
    });

    it('should handle typing indicator', () => {
      // Get the typing handler
      const typingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'typing')[1];
      
      // Call typing handler
      typingHandler({ groupId: 'group123', isTyping: true });

      expect(mockSocket.to).toHaveBeenCalledWith('group123');
      expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
        userId: mockUser._id,
        username: mockUser.username,
        isTyping: true
      });
    });

    it('should handle location sharing', () => {
      // Get the location handler
      const locationHandler = mockSocket.on.mock.calls.find(call => call[0] === 'shareLocation')[1];
      
      // Call location handler
      locationHandler({
        groupId: 'group123',
        location: {
          lat: 41.0082,
          lng: 28.9784
        }
      });

      expect(mockSocket.to).toHaveBeenCalledWith('group123');
      expect(mockSocket.emit).toHaveBeenCalledWith('locationShared', {
        userId: mockUser._id,
        username: mockUser.username,
        location: {
          lat: 41.0082,
          lng: 28.9784
        }
      });
    });
  });

  describe('Disconnection', () => {
    it('should handle user disconnection', () => {
      // Simulate connection
      mockSocket.handshake.auth.token = 'valid-token';
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      // Get the disconnect handler
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      // Call disconnect handler
      disconnectHandler();

      expect(mockServer.emit).toHaveBeenCalledWith('userDisconnected', {
        userId: mockUser._id,
        username: mockUser.username
      });
    });
  });
}); 