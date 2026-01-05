const request = require('supertest');
const path = require('path');

jest.mock('../src/socket', () => ({
  emitMapPinCreated: jest.fn(),
  emitMapPinDeleted: jest.fn()
}));

const { emitMapPinCreated, emitMapPinDeleted } = require('../src/socket');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const MapPin = require('../src/models/MapPin');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Map Pin Endpoints', () => {
  let testUser;
  let otherUser;
  let authToken;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    testUser = await User.create({
      username: 'pinuser',
      email: 'pinuser@example.com',
      password: 'password123',
      fullName: 'Pin User'
    });

    otherUser = await User.create({
      username: 'otherpin',
      email: 'otherpin@example.com',
      password: 'password123',
      fullName: 'Other Pin'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pinuser@example.com', password: 'password123' });

    authToken = loginRes.body?.data?.token;
    if (!authToken) {
      throw new Error('Failed to obtain auth token');
    }
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('POST /api/map-pins', () => {
    it('creates a map pin successfully', async () => {
      const res = await request(app)
        .post('/api/map-pins')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Meetup Point',
          description: 'Morning ride start',
          type: 'meetup',
          latitude: 41.0082,
          longitude: 28.9784,
          isPublic: true
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pin).toHaveProperty('title', 'Meetup Point');
      expect(res.body.data.pin.latitude).toBeCloseTo(41.0082);
      expect(res.body.data.pin.longitude).toBeCloseTo(28.9784);

      const stored = await MapPin.findOne({ title: 'Meetup Point' });
      expect(stored).not.toBeNull();

      expect(emitMapPinCreated).toHaveBeenCalledTimes(1);
      const [emittedPin] = emitMapPinCreated.mock.calls[0];
      expect(emittedPin).toBeDefined();
      expect(emittedPin.title).toBe('Meetup Point');
    });

    it('validates coordinate range', async () => {
      const res = await request(app)
        .post('/api/map-pins')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Bad Pin',
          latitude: 200,
          longitude: 200
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/map-pins/nearby', () => {
    it('returns nearby public pins', async () => {
      await MapPin.create({
        user: otherUser._id,
        title: 'Fuel Stop',
        description: '24/7 pump',
        type: 'fuel',
        location: { type: 'Point', coordinates: [28.9784, 41.0082] },
        isPublic: true
      });

      const res = await request(app)
        .get('/api/map-pins/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ latitude: 41.0082, longitude: 28.9784, radius: 500 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.pins[0].title).toBe('Fuel Stop');
    });

    it('filters by pin types', async () => {
      await MapPin.insertMany([
        {
          user: otherUser._id,
          title: 'Coffee Break',
          type: 'food',
          location: { type: 'Point', coordinates: [28.9784, 41.0082] },
          isPublic: true
        },
        {
          user: otherUser._id,
          title: 'Hazard Zone',
          type: 'hazard',
          location: { type: 'Point', coordinates: [28.9785, 41.0083] },
          isPublic: true
        }
      ]);

      const res = await request(app)
        .get('/api/map-pins/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ latitude: 41.0082, longitude: 28.9784, radius: 500, types: 'hazard' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.pins[0].title).toBe('Hazard Zone');
    });
  });

  describe('GET /api/map-pins/mine', () => {
    it('returns pins created by current user', async () => {
      await MapPin.create({
        user: testUser._id,
        title: 'Checkpoint',
        type: 'checkpoint',
        location: { type: 'Point', coordinates: [29.0, 41.0] },
        isPublic: false
      });

      const res = await request(app)
        .get('/api/map-pins/mine')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.pins[0].title).toBe('Checkpoint');
      expect(res.body.data.pins[0].isPublic).toBe(false);
    });
  });

  describe('DELETE /api/map-pins/:pinId', () => {
    it('allows owner to delete pin', async () => {
      const pin = await MapPin.create({
        user: testUser._id,
        title: 'Temporary Meeting',
        location: { type: 'Point', coordinates: [30.0, 41.0] },
        isPublic: true
      });

      const res = await request(app)
        .delete(`/api/map-pins/${pin._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.message).toBe('Map pin deleted');
      const remaining = await MapPin.findById(pin._id);
      expect(remaining).toBeNull();

      expect(emitMapPinDeleted).toHaveBeenCalledTimes(1);
      const [deletedPin] = emitMapPinDeleted.mock.calls[0];
      expect(deletedPin).toBeDefined();
      expect(deletedPin.title).toBe('Temporary Meeting');
    });

    it('prevents deleting pins owned by others', async () => {
      const pin = await MapPin.create({
        user: otherUser._id,
        title: 'Other Pin',
        location: { type: 'Point', coordinates: [30.0, 41.0] },
        isPublic: true
      });

      const res = await request(app)
        .delete(`/api/map-pins/${pin._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('validates pin id format', async () => {
      const res = await request(app)
        .delete('/api/map-pins/not-an-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
