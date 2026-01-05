const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const app = require('../src/app');
const User = require('../src/models/User');
const Story = require('../src/models/Story');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Story Endpoints', () => {
  let testUser;
  let authToken;
  let testStory;
  let viewerUser;
  let viewerToken;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await clearDB();

    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User'
    });
    await testUser.save();

    // Create viewer user
    viewerUser = new User({
      username: 'viewer',
      email: 'viewer@example.com',
      password: 'password123',
      fullName: 'Viewer User'
    });
    await viewerUser.save();

    // Login to get tokens
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginRes.body.data.token;

    const viewerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'viewer@example.com',
        password: 'password123'
      });

    viewerToken = viewerLoginRes.body.data.token;

    // Create test story
    testStory = new Story({
      user: testUser._id,
      mediaUrl: 'test-media-url',
      mediaType: 'image',
      duration: 24
    });
    await testStory.save();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('POST /stories', () => {
    it('should create story successfully', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .field('mediaType', 'image')
        .field('duration', 24)
        .attach('media', Buffer.from('fake image data'), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.story).toHaveProperty('_id');
      expect(res.body.data.story.mediaType).toBe('image');
      expect(res.body.data.story.duration).toBe(24);
    });

    it('should return 400 when media type is invalid', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .field('mediaType', 'invalid')
        .field('duration', 24)
        .attach('media', Buffer.from('fake image data'), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when media file is missing', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .field('mediaType', 'image')
        .field('duration', 24);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when duration is invalid', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .field('mediaType', 'image')
        .field('duration', 0)
        .attach('media', Buffer.from('fake image data'), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /stories', () => {
    it('should get stories from followed users successfully', async () => {
      const res = await request(app)
        .get('/api/stories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.stories)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should handle pagination parameters', async () => {
      const res = await request(app)
        .get('/api/stories?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stories.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /stories/:storyId/view', () => {
    it('should view story successfully', async () => {
      const res = await request(app)
        .post(`/api/stories/${testStory._id}/view`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Story viewed successfully');
    });

    it('should return 404 for non-existent story', async () => {
      const res = await request(app)
        .post('/api/stories/nonexistentid/view')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STORY_NOT_FOUND');
    });

    it('should return 403 when viewing own story', async () => {
      const res = await request(app)
        .post(`/api/stories/${testStory._id}/view`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /stories/:storyId/views', () => {
    it('should get story views successfully', async () => {
      const res = await request(app)
        .get(`/api/stories/${testStory._id}/views`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.views)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should return 403 when getting views of another user\'s story', async () => {
      // Create another user's story
      const otherStory = new Story({
        user: viewerUser._id,
        mediaUrl: 'other-media-url',
        mediaType: 'image',
        duration: 24
      });
      await otherStory.save();

      const res = await request(app)
        .get(`/api/stories/${otherStory._id}/views`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should handle pagination parameters for views', async () => {
      const res = await request(app)
        .get(`/api/stories/${testStory._id}/views?limit=5&offset=0`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.views.length).toBeLessThanOrEqual(5);
      expect(res.body.data).toHaveProperty('total');
    });
  });
}); 