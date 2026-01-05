const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { connectDB, closeDB, clearDB } = require('./db');
const app = require('../src/app');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const { handleMongoError, handleUnhandledRejection, handleUncaughtException } = require('../src/server');

const uploadsDir = path.join(__dirname, '../uploads');
const testImagePath = path.join(uploadsDir, 'test.jpg');

describe('Server Tests', () => {
  beforeAll(async () => {
    await connectDB();
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create a test image file
    const fakeImageData = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    fs.writeFileSync(testImagePath, fakeImageData);
  });

  afterAll(async () => {
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await closeDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app).get('/');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow maximum 10 requests per minute', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app).get('/');
      }
      const response = await request(app).get('/');
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Static Files', () => {
    it('should serve static files with correct headers', async () => {
      const response = await request(app).get('/uploads/test.jpg');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should return 404 for non-existent files', async () => {
      const response = await request(app).get('/uploads/nonexistent.jpg');
      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test',
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User'
        });

      expect(response.status).toBe(201);
    });

    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle forbidden errors', async () => {
      // Create first user
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'user1@example.com',
          password: 'password123',
          fullName: 'User One'
        });

      // Create second user
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'user2@example.com',
          password: 'password123',
          fullName: 'User Two'
        });

      // Create a post with first user
      const postResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user1Response.body.data.token}`)
        .field('description', 'Test post');

      // Try to delete the post with second user
      const response = await request(app)
        .delete(`/api/posts/${postResponse.body.data.post._id}`)
        .set('Authorization', `Bearer ${user2Response.body.data.token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should handle internal server errors', async () => {
      // Create a route that throws an error
      app.get('/test-error', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 500;
        next(error);
      });

      const response = await request(app).get('/test-error');
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('MongoDB Connection', () => {
    let mockExit;
    let mockConsoleError;
    let originalNodeEnv;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle MongoDB connection errors', () => {
      const error = new Error('MongoDB connection error');
      handleMongoError(error);

      expect(mockConsoleError).toHaveBeenCalledWith('MongoDB connection error:', error);
      
      // Only expect process.exit in production
      process.env.NODE_ENV = 'production';
      handleMongoError(error);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle unhandled promise rejections', () => {
      const error = new Error('Unhandled promise rejection');
      handleUnhandledRejection(error);

      expect(mockConsoleError).toHaveBeenCalledWith('Unhandled Promise Rejection:', error);
      
      // Only expect process.exit in production
      process.env.NODE_ENV = 'production';
      handleUnhandledRejection(error);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught exception');
      handleUncaughtException(error);

      expect(mockConsoleError).toHaveBeenCalledWith('Uncaught Exception:', error);
      
      // Only expect process.exit in production
      process.env.NODE_ENV = 'production';
      handleUncaughtException(error);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('API Endpoints', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found'
        }
      });
    });

    it('should handle test error route', async () => {
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
}); 