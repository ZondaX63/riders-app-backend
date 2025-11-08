const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const UserLocation = require('./models/UserLocation');
const { formatLocation } = require('./utils/locationFormatter');

let ioInstance;

const LOCATION_ROOM_PREFIX = 'location:';
const USER_ROOM_PREFIX = 'user:';
const MAP_PIN_PUBLIC_ROOM = 'mapPins:public';
const MAP_PIN_USER_ROOM_PREFIX = 'mapPins:user:';

const getLocationRoom = (userId) => `${LOCATION_ROOM_PREFIX}${userId}`;
const getUserRoom = (userId) => `${USER_ROOM_PREFIX}${userId}`;
const getMapPinUserRoom = (userId) => `${MAP_PIN_USER_ROOM_PREFIX}${userId}`;
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);

const isValidCoordinatePair = (latitude, longitude) => {
	const lat = Number(latitude);
	const lng = Number(longitude);

	return Number.isFinite(lat) && Number.isFinite(lng) &&
		lat >= -90 && lat <= 90 &&
		lng >= -180 && lng <= 180;
};

const safeCallback = (callback, payload) => {
	if (typeof callback === 'function') {
		callback(payload);
	}
};

const emitLocationUpdate = (userId, location) => {
	if (!ioInstance) {
		return;
	}

	const targetUserId = userId.toString();
	const room = getLocationRoom(targetUserId);
	ioInstance.to(room).emit('location:update', location);
};

const emitLocationHidden = (userId) => {
	if (!ioInstance) {
		return;
	}

	const targetUserId = userId.toString();
	const room = getLocationRoom(targetUserId);
	ioInstance.to(room).emit('location:hidden', { userId: targetUserId });
};

const emitLocationRemoved = (userId) => {
	if (!ioInstance) {
		return;
	}

	const targetUserId = userId.toString();
	const room = getLocationRoom(targetUserId);
	ioInstance.to(room).emit('location:removed', { userId: targetUserId });
};

const normalizePinPayload = (pin) => {
	if (!pin) {
		return null;
	}

	if (typeof pin.toClientJSON === 'function') {
		return pin.toClientJSON(true);
	}

	if (pin.toObject) {
		const obj = pin.toObject({ virtuals: false });
		return normalizePinPayload(obj);
	}

	const user = pin.user || {};
	const userId = pin.userId || user._id || user;
	const latitude = pin.latitude ?? pin.location?.coordinates?.[1] ?? null;
	const longitude = pin.longitude ?? pin.location?.coordinates?.[0] ?? null;

	return {
		id: pin.id || pin._id,
		userId,
		title: pin.title,
		description: pin.description,
		type: pin.type,
		latitude,
		longitude,
		isPublic: typeof pin.isPublic === 'boolean' ? pin.isPublic : true,
		expiresAt: pin.expiresAt || null,
		createdAt: pin.createdAt,
		updatedAt: pin.updatedAt,
		user: user && typeof user === 'object' && user._id ? {
			id: user._id,
			username: user.username,
			fullName: user.fullName,
			profilePicture: user.profilePicture
		} : undefined
	};
};

const emitMapPinCreated = (pin) => {
	if (!ioInstance) {
		return;
	}

	const payload = normalizePinPayload(pin);
	if (!payload) {
		return;
	}

	const targetUserRoom = getMapPinUserRoom(payload.userId);
	ioInstance.to(targetUserRoom).emit('mapPin:created', payload);

	if (payload.isPublic) {
		ioInstance.to(MAP_PIN_PUBLIC_ROOM).emit('mapPin:created', payload);
	}
};

const emitMapPinDeleted = (pin) => {
	if (!ioInstance) {
		return;
	}

	const payload = normalizePinPayload(pin) || pin;
	if (!payload) {
		return;
	}

	const message = {
		id: payload.id || payload._id,
		userId: payload.userId || payload.user?._id || payload.user
	};

	if (!message.id || !message.userId) {
		return;
	}

	const targetUserRoom = getMapPinUserRoom(message.userId);
	ioInstance.to(targetUserRoom).emit('mapPin:deleted', message);
	ioInstance.to(MAP_PIN_PUBLIC_ROOM).emit('mapPin:deleted', message);
};

const initializeSocket = (server) => {
	ioInstance = socketIO(server, {
		cors: {
			origin: (origin, callback) => {
				if (!origin) {
					return callback(null, true);
				}

				if ((process.env.CLIENT_URL && origin === process.env.CLIENT_URL) || isLocalhostOrigin(origin)) {
					return callback(null, true);
				}

				return callback(new Error('Not allowed by CORS'));
			},
			methods: ['GET', 'POST'],
			credentials: true
		}
	});

	ioInstance.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token;
			if (!token) {
				return next(new Error('Authentication token required'));
			}

			if (!process.env.JWT_SECRET) {
				return next(new Error('Server configuration error'));
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

	ioInstance.on('connection', (socket) => {
		console.log('User connected:', socket.user._id);

		const userId = socket.user._id.toString();
		socket.join(getUserRoom(userId));
		socket.join(getLocationRoom(userId));
		socket.join(getMapPinUserRoom(userId));

		socket.on('location:subscribe', ({ userId: targetUserId }) => {
			if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
				return;
			}
			socket.join(getLocationRoom(targetUserId));
		});

		socket.on('location:unsubscribe', ({ userId: targetUserId }) => {
			if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
				return;
			}
			socket.leave(getLocationRoom(targetUserId));
		});

		socket.on('mapPin:subscribe', () => {
			socket.join(MAP_PIN_PUBLIC_ROOM);
		});

		socket.on('mapPin:unsubscribe', () => {
			socket.leave(MAP_PIN_PUBLIC_ROOM);
		});

		socket.on('location:update', async (payload = {}, callback) => {
			const {
				latitude,
				longitude,
				speed = null,
				heading = null,
				altitude = null,
				accuracy = null,
				isVisible,
				status
			} = payload;

			if (!isValidCoordinatePair(latitude, longitude)) {
				return safeCallback(callback, {
					success: false,
					error: 'Invalid coordinates'
				});
			}

			const resolvedVisibility = typeof isVisible === 'boolean' ? isVisible : true;
			const resolvedStatus = status || (resolvedVisibility ? 'active' : 'hidden');

			try {
				const locationDoc = await UserLocation.findOneAndUpdate(
					{ user: socket.user._id },
					{
						user: socket.user._id,
						location: {
							type: 'Point',
							coordinates: [Number(longitude), Number(latitude)]
						},
						speed,
						heading,
						altitude,
						accuracy,
						isVisible: resolvedVisibility,
						status: resolvedStatus,
						lastSeenAt: new Date()
					},
					{
						upsert: true,
						new: true,
						setDefaultsOnInsert: true
					}
				).populate('user', 'username fullName profilePicture motorcycleInfo');

				const formatted = formatLocation(locationDoc);
				safeCallback(callback, {
					success: true,
					location: formatted
				});

				if (formatted?.isVisible) {
					emitLocationUpdate(socket.user._id, formatted);
				} else {
					emitLocationHidden(socket.user._id);
				}
			} catch (error) {
				console.error('Socket location update error:', error);
				safeCallback(callback, {
					success: false,
					error: 'Failed to update location'
				});
			}
		});

		socket.on('location:visibility', async ({ isVisible } = {}, callback) => {
			if (typeof isVisible !== 'boolean') {
				return safeCallback(callback, {
					success: false,
					error: 'isVisible must be a boolean'
				});
			}

			try {
				const locationDoc = await UserLocation.findOneAndUpdate(
					{ user: socket.user._id },
					{
						isVisible,
						status: isVisible ? 'active' : 'hidden',
						lastSeenAt: new Date()
					},
					{ new: true }
				).populate('user', 'username fullName profilePicture motorcycleInfo');

				if (!locationDoc) {
					return safeCallback(callback, {
						success: false,
						error: 'LOCATION_NOT_FOUND'
					});
				}

				const formatted = formatLocation(locationDoc);
				safeCallback(callback, {
					success: true,
					location: formatted
				});

				if (formatted.isVisible) {
					emitLocationUpdate(socket.user._id, formatted);
				} else {
					emitLocationHidden(socket.user._id);
				}
			} catch (error) {
				console.error('Socket location visibility error:', error);
				safeCallback(callback, {
					success: false,
					error: 'Failed to update visibility'
				});
			}
		});

		socket.on('location:stop', async (callback) => {
			try {
				await UserLocation.deleteOne({ user: socket.user._id });
				safeCallback(callback, { success: true });
				emitLocationRemoved(socket.user._id);
			} catch (error) {
				console.error('Socket stop location error:', error);
				safeCallback(callback, {
					success: false,
					error: 'Failed to disable location sharing'
				});
			}
		});

		// Group chat compatibility events
		socket.on('joinGroup', ({ groupId }) => {
			socket.join(groupId);
			socket.to(groupId).emit('userJoined', {
				userId: socket.user._id,
				username: socket.user.username
			});
		});

		socket.on('leaveGroup', ({ groupId }) => {
			socket.leave(groupId);
			socket.to(groupId).emit('userLeft', {
				userId: socket.user._id,
				username: socket.user.username
			});
		});

		socket.on('typing', ({ groupId, isTyping }) => {
			socket.to(groupId).emit('typing', {
				userId: socket.user._id,
				username: socket.user.username,
				isTyping
			});
		});

		socket.on('shareLocation', ({ groupId, location }) => {
			socket.to(groupId).emit('locationShared', {
				userId: socket.user._id,
				username: socket.user.username,
				location
			});
		});

		socket.on('disconnect', async () => {
			console.log('User disconnected:', socket.user._id);

			try {
				await UserLocation.findOneAndUpdate(
					{ user: socket.user._id },
					{ lastSeenAt: new Date(), status: 'idle' }
				);
			} catch (error) {
				console.error('Socket disconnect location update error:', error);
			}

			ioInstance.emit('userDisconnected', {
				userId: socket.user._id,
				username: socket.user.username
			});
		});
	});

	return ioInstance;
};

const getIO = () => {
	if (!ioInstance) {
		throw new Error('Socket.io not initialized');
	}
	return ioInstance;
};

module.exports = {
	initializeSocket,
	getIO,
	emitMapPinCreated,
	emitMapPinDeleted
};
























































// New implementation goes here