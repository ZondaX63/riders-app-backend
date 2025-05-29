const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const { connectDB, closeDB, clearDB } = require('./db');

describe('User Endpoints', () => {
  let testUser;
  let authToken;
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

    // Create another user
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
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('GET /users/:userId', () => {
    it('should get user profile successfully', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('_id');
      expect(res.body.data.user).toHaveProperty('username', 'testuser');
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /users/:userId', () => {
    it('should update user profile successfully', async () => {
      const res = await request(app)
        .put(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fullName: 'Updated Name',
          bio: 'New bio'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.fullName).toBe('Updated Name');
      expect(res.body.data.user.bio).toBe('New bio');
    });

    it('should return 403 when updating another user\'s profile', async () => {
      const res = await request(app)
        .put(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fullName: 'Updated Name'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /users/:userId/profile-picture', () => {
    it('should upload profile picture successfully', async () => {
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      const res = await request(app)
        .post(`/api/users/${testUser._id}/profile-picture`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('profilePicture', testImagePath);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('profilePicture');
    });

    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post(`/api/users/${testUser._id}/profile-picture`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NO_FILE');
    });
  });

  describe('GET /users/search', () => {
    it('should search users successfully', async () => {
      const res = await request(app)
        .get('/api/users/search?q=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should return 400 when search query is missing', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_QUERY');
    });
  });

  describe('POST /users/:userId/follow', () => {
    it('should follow user successfully', async () => {
      const res = await request(app)
        .post(`/api/users/${otherUser._id}/follow`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Successfully followed user');
    });

    it('should return 400 when trying to follow self', async () => {
      const res = await request(app)
        .post(`/api/users/${testUser._id}/follow`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ACTION');
    });
  });

  describe('DELETE /users/:userId/follow', () => {
    it('should unfollow user successfully', async () => {
      // First follow the user
      await request(app)
        .post(`/api/users/${otherUser._id}/follow`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then unfollow
      const res = await request(app)
        .delete(`/api/users/${otherUser._id}/follow`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Successfully unfollowed user');
    });
  });

  describe('GET /users/:userId/followers', () => {
    it('should get user followers successfully', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser._id}/followers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.followers)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('GET /users/:userId/following', () => {
    it('should get user following successfully', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser._id}/following`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.following)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });
  });
}); 