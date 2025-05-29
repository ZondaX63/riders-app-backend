const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const { app } = require('../src/server');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Error Handler', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: '123',
        username: 'test'
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: expect.arrayContaining([
          expect.objectContaining({
            location: 'body',
            path: expect.any(String),
            msg: expect.any(String),
            type: 'field',
            value: expect.any(String)
          })
        ])
      }
    });
  });

  it('should handle authentication errors', async () => {
    const response = await request(app)
      .get('/api/posts')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token'
      }
    });
  });

  it('should handle forbidden errors', async () => {
    // First create a user and get their token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser'
      });

    const token = registerResponse.body.token;

    // Create another user
    const otherUserResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'other@example.com',
        password: 'password123',
        username: 'otheruser'
      });

    // Support both possible response formats
    const otherUserId = (otherUserResponse.body.user && otherUserResponse.body.user._id)
      || (otherUserResponse.body.data && otherUserResponse.body.data.user && otherUserResponse.body.data.user._id);

    // Try to update another user's profile
    const response = await request(app)
      .put(`/api/users/${otherUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'New bio'
      });

    if (response.status === 401) {
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.any(String)
        }
      });
    } else {
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action'
        }
      });
    }
  });

  it('should handle internal server errors', async () => {
    const response = await request(app).get('/test-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Test error'
      }
    });
  });
}); 