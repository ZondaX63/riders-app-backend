const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Post Endpoints', () => {
  let testUser;
  let authToken;
  let testPost;

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

    // Create test post
    testPost = new Post({
      user: testUser._id,
      description: 'Test post',
      images: ['test-image-url']
    });
    await testPost.save();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('POST /posts', () => {
    it('should create a new post successfully', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .field('description', 'New test post')
        .field('location[latitude]', 40.7128)
        .field('location[longitude]', -74.0060)
        .field('location[name]', 'New York')
        .attach('images', Buffer.from('fake image data'), {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post).toHaveProperty('_id');
      expect(res.body.data.post.description).toBe('New test post');
      expect(res.body.data.post.images).toHaveLength(1);
    });

    it('should return 400 for invalid input data', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: '', // empty description
          location: {
            latitude: 'invalid', // invalid latitude
            longitude: -74.0060
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/posts')
        .send({
          description: 'Test post',
          location: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /posts', () => {
    it('should get feed posts successfully', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/posts');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /posts/:id', () => {
    it('should get post details successfully', async () => {
      const res = await request(app)
        .get(`/api/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post).toHaveProperty('_id', testPost._id.toString());
      expect(res.body.data.post.description).toBe(testPost.description);
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app)
        .get('/api/posts/nonexistentid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('POST_NOT_FOUND');
    });
  });

  describe('PUT /posts/:id', () => {
    it('should update post successfully', async () => {
      const res = await request(app)
        .put(`/api/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated test post',
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            name: 'New York'
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post).toHaveProperty('_id', testPost._id.toString());
      expect(res.body.data.post.description).toBe('Updated test post');
    });

    it('should return 403 when updating another user\'s post', async () => {
      // Create another user
      const otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        fullName: 'Other User'
      });
      await otherUser.save();

      // Create a post for the other user
      const otherPost = new Post({
        user: otherUser._id,
        description: 'Other user\'s post',
        images: ['other-image.jpg']
      });
      await otherPost.save();

      const res = await request(app)
        .put(`/api/posts/${otherPost._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /posts/:id', () => {
    it('should delete post successfully', async () => {
      const res = await request(app)
        .delete(`/api/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Post deleted successfully');
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app)
        .delete('/api/posts/nonexistentid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('POST_NOT_FOUND');
    });
  });

  describe('POST /posts/:id/like', () => {
    it('should like post successfully', async () => {
      // Create a new post to like
      const post = new Post({
        user: testUser._id,
        description: 'Post to like',
        images: ['like-image.jpg']
      });
      await post.save();

      const res = await request(app)
        .post(`/api/posts/${post._id}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Post liked successfully');
    });

    it('should return 400 when liking already liked post', async () => {
      const post = new Post({
        user: testUser._id,
        description: 'Already liked post',
        images: ['liked-image.jpg'],
        likes: [testUser._id]
      });
      await post.save();

      const res = await request(app)
        .post(`/api/posts/${post._id}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_LIKED');
    });
  });

  describe('POST /posts/:id/comment', () => {
    it('should add comment successfully', async () => {
      const post = new Post({
        user: testUser._id,
        description: 'Post to comment',
        images: ['comment-image.jpg']
      });
      await post.save();

      const res = await request(app)
        .post(`/api/posts/${post._id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Test comment'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comment.content).toBe('Test comment');
    });

    it('should return 400 for empty comment', async () => {
      const res = await request(app)
        .post(`/api/posts/${testPost._id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: ''
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /posts/:id/comment/:commentId', () => {
    it('should delete comment successfully', async () => {
      const post = new Post({
        user: testUser._id,
        description: 'Post with comment',
        images: ['comment-image.jpg'],
        comments: [{
          user: testUser._id,
          content: 'Comment to delete'
        }]
      });
      await post.save();

      const commentId = post.comments[0]._id;

      const res = await request(app)
        .delete(`/api/posts/${post._id}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Comment deleted successfully');
    });

    it('should return 403 when deleting another user\'s comment', async () => {
      const otherUser = new User({
        username: 'commentuser',
        email: 'comment@example.com',
        password: 'password123',
        fullName: 'Comment User'
      });
      await otherUser.save();

      const post = new Post({
        user: testUser._id,
        description: 'Post with other user\'s comment',
        images: ['comment-image.jpg'],
        comments: [{
          user: otherUser._id,
          content: 'Other user\'s comment'
        }]
      });
      await post.save();

      const commentId = post.comments[0]._id;

      const res = await request(app)
        .delete(`/api/posts/${post._id}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
}); 