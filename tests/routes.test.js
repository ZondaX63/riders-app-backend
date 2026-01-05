const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Route Endpoints', () => {
  let testUser;
  let authToken;
  let testRoute;
  let otherUser;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User'
    });
    await testUser.save();

    // Create other user
    otherUser = new User({
      username: 'otheruser',
      email: 'other@example.com',
      password: 'password123',
      fullName: 'Other User'
    });
    await otherUser.save();

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    if (!loginRes.body.data || !loginRes.body.data.token) {
      console.error('Login response:', loginRes.body);
      throw new Error('Failed to get auth token');
    }

    authToken = loginRes.body.data.token;

    // Create test route
    testRoute = new Route({
      user: testUser._id,
      name: 'Test Route',
      description: 'A test route',
      waypoints: [
        {
          latitude: 41.0082,
          longitude: 28.9784,
          name: 'Waypoint 1',
          order: 1
        },
        {
          latitude: 41.0083,
          longitude: 28.9785,
          name: 'Waypoint 2',
          order: 2
        }
      ],
      isPublic: true,
      distance: 10,
      duration: 60
    });
    await testRoute.save();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('POST /routes', () => {
    it('should create route successfully', async () => {
      const res = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Route',
          description: 'A new test route',
          waypoints: [
            {
              latitude: 41.0082,
              longitude: 28.9784,
              name: 'Waypoint 1',
              order: 1
            },
            {
              latitude: 41.0083,
              longitude: 28.9785,
              name: 'Waypoint 2',
              order: 2
            }
          ],
          isPublic: true,
          distance: 15,
          duration: 90
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.route.name).toBe('New Route');
    });

    it('should return 400 for invalid route data', async () => {
      const res = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Invalid Route',
          // Missing required fields
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /routes', () => {
    it('should get public routes successfully', async () => {
      const res = await request(app)
        .get('/api/routes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.routes)).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const res = await request(app)
        .get('/api/routes?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.routes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /routes/:routeId', () => {
    it('should get route by id successfully', async () => {
      const res = await request(app)
        .get(`/api/routes/${testRoute._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.route.name).toBe('Test Route');
    });

    it('should return 404 for non-existent route', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/routes/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('GET /routes/user/:userId', () => {
    it('should get user routes successfully', async () => {
      const res = await request(app)
        .get(`/api/routes/user/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.routes)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should return empty array for user with no routes', async () => {
      const res = await request(app)
        .get(`/api/routes/user/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.routes).toHaveLength(0);
    });
  });

  describe('POST /routes/:routeId/share', () => {
    it('should share route successfully', async () => {
      const res = await request(app)
        .post(`/api/routes/${testRoute._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: otherUser._id
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Route shared successfully');
    });

    it('should return 404 for non-existent route', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/routes/${nonExistentId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: otherUser._id
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('should return 403 when sharing another user\'s route', async () => {
      // Create a route owned by other user
      const otherRoute = new Route({
        user: otherUser._id,
        name: 'Other Route',
        description: 'Another test route',
        waypoints: [
          {
            latitude: 41.0082,
            longitude: 28.9784,
            name: 'Waypoint 1',
            order: 1
          }
        ],
        isPublic: true,
        distance: 5,
        duration: 30
      });
      await otherRoute.save();

      const res = await request(app)
        .post(`/api/routes/${otherRoute._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser._id
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /routes/:routeId', () => {
    it('should update route successfully', async () => {
      const res = await request(app)
        .put(`/api/routes/${testRoute._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Route',
          description: 'An updated test route'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.route.name).toBe('Updated Route');
    });

    it('should return 404 for non-existent route', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/routes/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Route'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('should return 403 when updating another user\'s route', async () => {
      // Create a route owned by other user
      const otherRoute = new Route({
        user: otherUser._id,
        name: 'Other Route',
        description: 'Another test route',
        waypoints: [
          {
            latitude: 41.0082,
            longitude: 28.9784,
            name: 'Waypoint 1',
            order: 1
          }
        ],
        isPublic: true,
        distance: 5,
        duration: 30
      });
      await otherRoute.save();

      const res = await request(app)
        .put(`/api/routes/${otherRoute._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Route Name'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /routes/:routeId', () => {
    it('should delete route successfully', async () => {
      const res = await request(app)
        .delete(`/api/routes/${testRoute._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Route deleted successfully');
    });

    it('should return 404 for non-existent route', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/routes/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('should return 403 when deleting another user\'s route', async () => {
      // Create a route owned by other user
      const otherRoute = new Route({
        user: otherUser._id,
        name: 'Other Route',
        description: 'Another test route',
        waypoints: [
          {
            latitude: 41.0082,
            longitude: 28.9784,
            name: 'Waypoint 1',
            order: 1
          }
        ],
        isPublic: true,
        distance: 5,
        duration: 30
      });
      await otherRoute.save();

      const res = await request(app)
        .delete(`/api/routes/${otherRoute._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
}); 