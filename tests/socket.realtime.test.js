const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const UserLocation = require('../src/models/UserLocation');
const { initializeSocket } = require('../src/socket');

jest.mock('socket.io', () => {
  const instances = [];

  const socketIoMock = jest.fn(() => {
    const listeners = { middlewares: [], events: {} };

    const instance = {
      listeners,
      use: jest.fn((fn) => {
        listeners.middlewares.push(fn);
        return instance;
      }),
      on: jest.fn((event, handler) => {
        listeners.events[event] = handler;
        return instance;
      }),
      to: jest.fn(() => instance),
      emit: jest.fn()
    };

    instances.push(instance);
    return instance;
  });

  socketIoMock.__instances = instances;
  socketIoMock.__reset = () => {
    instances.length = 0;
  };

  return socketIoMock;
});

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../src/models/UserLocation', () => ({
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn()
}));

const createMockSocket = () => {
  const handlers = {};
  const broadcast = {
    emit: jest.fn(),
    to: jest.fn(() => broadcast)
  };

  return {
    handlers,
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => broadcast),
    broadcast,
    handshake: { auth: {} }
  };
};

describe('Socket realtime location flow', () => {
  let ioInstance;
  let authMiddleware;
  let connectionHandler;
  let mockSocket;
  let mockUser;

  const setupAuthenticatedSocket = async () => {
    mockSocket.handshake.auth.token = 'valid-token';
    const next = jest.fn();
    await authMiddleware(mockSocket, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.user).toEqual(mockUser);
    connectionHandler(mockSocket);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    socketIO.__reset();

    mockUser = {
      _id: '64f0c1d2f1a2b3c4d5e6f789',
      username: 'testuser',
      fullName: 'Test User'
    };

    jwt.verify.mockImplementation(() => ({ userId: mockUser._id }));
    User.findById.mockResolvedValue(mockUser);

    const defaultLocation = {
      _id: 'loc123',
      user: {
        _id: mockUser._id,
        username: mockUser.username,
        fullName: mockUser.fullName
      },
      location: {
        type: 'Point',
        coordinates: [30.0, 50.0]
      },
      speed: 10,
      heading: 90,
      altitude: null,
      accuracy: null,
      isVisible: true,
      status: 'active',
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    UserLocation.findOneAndUpdate.mockImplementation((_, update = {}) => ({
      populate: jest.fn().mockResolvedValue({
        ...defaultLocation,
        location: update.location || defaultLocation.location,
        speed: Object.prototype.hasOwnProperty.call(update, 'speed') ? update.speed : defaultLocation.speed,
        heading: Object.prototype.hasOwnProperty.call(update, 'heading') ? update.heading : defaultLocation.heading,
        altitude: Object.prototype.hasOwnProperty.call(update, 'altitude') ? update.altitude : defaultLocation.altitude,
        accuracy: Object.prototype.hasOwnProperty.call(update, 'accuracy') ? update.accuracy : defaultLocation.accuracy,
        isVisible: Object.prototype.hasOwnProperty.call(update, 'isVisible') ? update.isVisible : defaultLocation.isVisible,
        status: Object.prototype.hasOwnProperty.call(update, 'status') ? update.status : defaultLocation.status,
        lastSeenAt: update.lastSeenAt || defaultLocation.lastSeenAt
      })
    }));

    UserLocation.deleteOne.mockResolvedValue({ deletedCount: 1 });

    initializeSocket({});
    ioInstance = socketIO.__instances[0];
    authMiddleware = ioInstance.listeners.middlewares[0];
    connectionHandler = ioInstance.listeners.events.connection;

    mockSocket = createMockSocket();
  });

  describe('authentication', () => {
    it('authenticates and joins default rooms', async () => {
      await setupAuthenticatedSocket();
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(mockUser._id);
      expect(mockSocket.join).toHaveBeenCalledWith(`user:${mockUser._id}`);
      expect(mockSocket.join).toHaveBeenCalledWith(`location:${mockUser._id}`);
    });

    it('rejects when token missing', async () => {
      const next = jest.fn();
      await authMiddleware(mockSocket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication token required');
    });

    it('rejects when token invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      mockSocket.handshake.auth.token = 'broken';

      const next = jest.fn();
      await authMiddleware(mockSocket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Invalid token');
    });
  });

  describe('location lifecycle', () => {
    beforeEach(async () => {
      await setupAuthenticatedSocket();
      ioInstance.emit.mockClear();
      ioInstance.to.mockClear();
    });

    it('stores and broadcasts location updates', async () => {
      const callback = jest.fn();
      await mockSocket.handlers['location:update']({
        latitude: 50.1234,
        longitude: 30.5678,
        speed: 12,
        heading: 45
      }, callback);

      expect(UserLocation.findOneAndUpdate).toHaveBeenCalledWith(
        { user: mockUser._id },
        expect.objectContaining({
          location: {
            type: 'Point',
            coordinates: [30.5678, 50.1234]
          },
          speed: 12,
          heading: 45
        }),
        expect.objectContaining({ upsert: true, new: true, setDefaultsOnInsert: true })
      );
      expect(ioInstance.to).toHaveBeenCalledWith(`location:${mockUser._id}`);
      const updateCall = ioInstance.emit.mock.calls.find(([event]) => event === 'location:update');
      expect(updateCall).toBeDefined();
      const [, payload] = updateCall;
      expect(payload.latitude).toBeCloseTo(50.1234, 4);
      expect(payload.longitude).toBeCloseTo(30.5678, 4);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns validation error for invalid coordinates', async () => {
      const callback = jest.fn();
      await mockSocket.handlers['location:update']({ latitude: 250, longitude: 1000 }, callback);
      expect(UserLocation.findOneAndUpdate).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({ success: false, error: 'Invalid coordinates' });
    });

    it('emits hidden event when rider hides location', async () => {
      const hiddenDoc = {
        _id: 'locHidden',
        user: {
          _id: mockUser._id,
          username: mockUser.username,
          fullName: mockUser.fullName
        },
        location: {
          type: 'Point',
          coordinates: [28.0, 41.0]
        },
        isVisible: false,
        status: 'hidden',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      UserLocation.findOneAndUpdate.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(hiddenDoc)
      }));

      const callback = jest.fn();
      await mockSocket.handlers['location:update']({
        latitude: 41,
        longitude: 28,
        isVisible: false
      }, callback);

      expect(ioInstance.emit).toHaveBeenCalledWith('location:hidden', { userId: mockUser._id });
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

  it('toggles visibility', async () => {
      const callback = jest.fn();
      await mockSocket.handlers['location:visibility']({ isVisible: true }, callback);
      expect(UserLocation.findOneAndUpdate).toHaveBeenCalledWith(
        { user: mockUser._id },
        expect.objectContaining({ isVisible: true, status: 'active' }),
        { new: true }
      );
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns error when visibility toggled with no record', async () => {
      UserLocation.findOneAndUpdate.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(null)
      }));

      const callback = jest.fn();
      await mockSocket.handlers['location:visibility']({ isVisible: false }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error: 'LOCATION_NOT_FOUND' });
    });

    it('stops sharing and notifies subscribers', async () => {
      const callback = jest.fn();
      await mockSocket.handlers['location:stop'](callback);

      expect(UserLocation.deleteOne).toHaveBeenCalledWith({ user: mockUser._id });
      expect(ioInstance.emit).toHaveBeenCalledWith('location:removed', { userId: mockUser._id });
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it('subscribes and unsubscribes to rider updates', () => {
      mockSocket.handlers['location:subscribe']({ userId: mockUser._id });
      expect(mockSocket.join).toHaveBeenCalledWith(`location:${mockUser._id}`);

      mockSocket.handlers['location:unsubscribe']({ userId: mockUser._id });
      expect(mockSocket.leave).toHaveBeenCalledWith(`location:${mockUser._id}`);
    });
  });

  describe('group messaging compatibility', () => {
    beforeEach(async () => {
      await setupAuthenticatedSocket();
      mockSocket.broadcast.emit.mockClear();
      mockSocket.to.mockClear();
    });

    it('joins group rooms and notifies peers', () => {
      mockSocket.handlers.joinGroup({ groupId: 'group-1' });
      expect(mockSocket.join).toHaveBeenCalledWith('group-1');
      expect(mockSocket.to).toHaveBeenCalledWith('group-1');
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('userJoined', expect.objectContaining({ userId: mockUser._id }));
    });

    it('leaves group rooms cleanly', () => {
      mockSocket.handlers.leaveGroup({ groupId: 'group-1' });
      expect(mockSocket.leave).toHaveBeenCalledWith('group-1');
      expect(mockSocket.to).toHaveBeenCalledWith('group-1');
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('userLeft', expect.objectContaining({ userId: mockUser._id }));
    });

    it('emits typing status', () => {
      mockSocket.handlers.typing({ groupId: 'group-1', isTyping: true });
      expect(mockSocket.to).toHaveBeenCalledWith('group-1');
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('typing', expect.objectContaining({ isTyping: true }));
    });

    it('shares location payload inside group', () => {
      const payload = { lat: 41.0082, lng: 28.9784 };
      mockSocket.handlers.shareLocation({ groupId: 'group-1', location: payload });
      expect(mockSocket.to).toHaveBeenCalledWith('group-1');
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('locationShared', {
        userId: mockUser._id,
        username: mockUser.username,
        location: payload
      });
    });
  });

  describe('disconnect handling', () => {
    it('marks user idle and emits event', async () => {
      await setupAuthenticatedSocket();
      const disconnectHandler = mockSocket.handlers.disconnect;

      await disconnectHandler();

      expect(UserLocation.findOneAndUpdate).toHaveBeenCalledWith(
        { user: mockUser._id },
        expect.objectContaining({ status: 'idle' })
      );
      expect(ioInstance.emit).toHaveBeenCalledWith('userDisconnected', expect.objectContaining({ userId: mockUser._id }));
    });
  });
});
