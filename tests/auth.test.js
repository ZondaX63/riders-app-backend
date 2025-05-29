const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const { connectDB, closeDB, clearDB } = require('./db');
const jwt = require('jsonwebtoken');

describe('Authentication Endpoints', () => {
  let testUser;
  let authToken;

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
    console.log('Test user created:', testUser);

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    console.log('Login response:', loginRes.body);

    authToken = loginRes.body.data.token;
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          fullName: 'New User'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.username).toBe('newuser');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 400 for invalid input data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'us',
          email: 'invalid',
          password: '123',
          fullName: ''
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for duplicate email or username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('id');
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.username).toBe('testuser');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should send password reset email successfully', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'test@example.com'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('message', 'Password reset email sent');
      expect(res.body.data).toHaveProperty('resetToken');
    });

    it('should return 404 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /auth/confirm-reset', () => {
    let resetToken;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'test@example.com'
        });
      resetToken = res.body.data.resetToken;
    });

    it('should reset password successfully', async () => {
      const res = await request(app)
        .post('/api/auth/confirm-reset')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Password reset successful');
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/confirm-reset')
        .send({
          token: 'invalidtoken',
          newPassword: 'newpassword123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 400 for invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/confirm-reset')
        .send({
          token: resetToken,
          newPassword: '123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Auth Middleware', () => {
    it('should handle missing JWT_SECRET environment variable', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should handle token with invalid format', async () => {
      const invalidToken = jwt.sign({}, 'wrong-secret');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle token with missing userId', async () => {
      const tokenWithoutUserId = jwt.sign({}, process.env.JWT_SECRET);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenWithoutUserId}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle token with non-existent user', async () => {
      const tokenWithNonExistentUser = jwt.sign(
        { userId: new mongoose.Types.ObjectId() },
        process.env.JWT_SECRET
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenWithNonExistentUser}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Admin Auth Middleware', () => {
    it('should allow admin access', async () => {
      // Create admin user
      const adminUser = new User({
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'password123',
        fullName: 'Admin User',
        role: 'admin'
      });
      await adminUser.save();

      // Login as admin
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      const adminToken = loginRes.body.data.token;

      // Test admin route
      const res = await request(app)
        .get('/api/admin/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should deny non-admin access', async () => {
      const res = await request(app)
        .get('/api/admin/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
}); 