const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const UserLocation = require('../src/models/UserLocation');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Location Endpoints', () => {
  let testUser;
  let otherUser;
  let authToken;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    testUser = await User.create({
      username: 'rider1',
      email: 'rider1@example.com',
      password: 'password123',
      fullName: 'Rider One'
    });

    otherUser = await User.create({
      username: 'rider2',
      email: 'rider2@example.com',
      password: 'password123',
      fullName: 'Rider Two'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'rider1@example.com',
        password: 'password123'
      });

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

  describe('PUT /api/locations/me', () => {
    it('stores and returns the current user location', async () => {
      const response = await request(app)
        .put('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          latitude: 40.7128,
          longitude: -74.006,
          speed: 12.5,
          heading: 90
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.location.latitude).toBeCloseTo(40.7128);
      expect(response.body.data.location.longitude).toBeCloseTo(-74.006);
      expect(response.body.data.location.status).toBe('active');

      const stored = await UserLocation.findOne({ user: testUser._id });
      expect(stored).not.toBeNull();
      expect(stored.location.coordinates[0]).toBeCloseTo(-74.006);
      expect(stored.location.coordinates[1]).toBeCloseTo(40.7128);
    });

    it('honors visibility flag and updates status', async () => {
      const response = await request(app)
        .put('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          latitude: 34.0522,
          longitude: -118.2437,
          isVisible: false
        });

      expect(response.status).toBe(200);
      expect(response.body.data.location.isVisible).toBe(false);
      expect(response.body.data.location.status).toBe('hidden');
    });

    it('rejects invalid coordinates', async () => {
      const response = await request(app)
        .put('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          latitude: 123,
          longitude: 456
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/locations/me', () => {
    it('returns 404 when no location set', async () => {
      const response = await request(app)
        .get('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LOCATION_NOT_FOUND');
    });

    it('returns stored location', async () => {
      await UserLocation.create({
        user: testUser._id,
        location: { type: 'Point', coordinates: [-3.7038, 40.4168] },
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.location.latitude).toBeCloseTo(40.4168);
      expect(response.body.data.location.longitude).toBeCloseTo(-3.7038);
    });
  });

  describe('PATCH /api/locations/me/visibility', () => {
    it('toggles visibility for existing location', async () => {
      await UserLocation.create({
        user: testUser._id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        isVisible: true,
        status: 'active',
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .patch('/api/locations/me/visibility')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isVisible: false });

      expect(response.status).toBe(200);
      expect(response.body.data.location.isVisible).toBe(false);
      expect(response.body.data.location.status).toBe('hidden');
    });

    it('returns 404 when toggling before location exists', async () => {
      const response = await request(app)
        .patch('/api/locations/me/visibility')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isVisible: true });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LOCATION_NOT_FOUND');
    });
  });

  describe('GET /api/locations/nearby', () => {
    it('returns nearby visible riders', async () => {
      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [-74.006, 40.7128] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get('/api/locations/nearby')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ latitude: 40.7127, longitude: -74.0059, radius: 500 });

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.locations[0].userId.toString()).toBe(otherUser._id.toString());
    });
  });

  describe('GET /api/locations/following', () => {
    it('returns visible locations for followed riders', async () => {
      testUser.following = [otherUser._id];
      await testUser.save();

      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [12.4964, 41.9028] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get('/api/locations/following')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.locations[0].userId.toString()).toBe(otherUser._id.toString());
    });

    it('includes current user when includeSelf=true', async () => {
      testUser.following = [otherUser._id];
      await testUser.save();

      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [139.6917, 35.6895] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      await UserLocation.create({
        user: testUser._id,
        location: { type: 'Point', coordinates: [-0.1276, 51.5072] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get('/api/locations/following')
        .query({ includeSelf: true })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(2);
      const ids = response.body.data.locations.map((loc) => loc.userId.toString());
      expect(ids).toEqual(expect.arrayContaining([testUser._id.toString(), otherUser._id.toString()]));
    });

    it('omits hidden riders from results', async () => {
      testUser.following = [otherUser._id];
      await testUser.save();

      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [18.0686, 59.3293] },
        isVisible: false,
        status: 'hidden',
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get('/api/locations/following')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.locations).toHaveLength(0);
    });
  });

  describe('GET /api/locations/users/:userId', () => {
    it('returns specific user location when visible', async () => {
      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [12.4964, 41.9028] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get(`/api/locations/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.location.latitude).toBeCloseTo(41.9028);
      expect(response.body.data.location.longitude).toBeCloseTo(12.4964);
    });

    it('returns 404 when user hides location', async () => {
      await UserLocation.create({
        user: otherUser._id,
        location: { type: 'Point', coordinates: [12.4964, 41.9028] },
        isVisible: false,
        status: 'hidden',
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .get(`/api/locations/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LOCATION_NOT_FOUND');
    });

    it('validates user id', async () => {
      const response = await request(app)
        .get('/api/locations/users/not-a-valid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/locations/me', () => {
    it('removes existing location', async () => {
      await UserLocation.create({
        user: testUser._id,
        location: { type: 'Point', coordinates: [2.3522, 48.8566] },
        isVisible: true,
        lastSeenAt: new Date()
      });

      const response = await request(app)
        .delete('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('Location sharing disabled');

      const existing = await UserLocation.findOne({ user: testUser._id });
      expect(existing).toBeNull();
    });

    it('returns 404 if no location exists', async () => {
      const response = await request(app)
        .delete('/api/locations/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LOCATION_NOT_FOUND');
    });
  });
});
