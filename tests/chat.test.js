const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const app = require('../src/app');
const User = require('../src/models/User');
const { Conversation, Message } = require('../src/models/Chat');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Chat Endpoints', () => {
  let testUser1;
  let testUser2;
  let authToken;
  let testConversation;
  let testMessage;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    // Create test users
    testUser1 = new User({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123',
      fullName: 'Test User 1'
    });
    await testUser1.save();

    testUser2 = new User({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123',
      fullName: 'Test User 2'
    });
    await testUser2.save();

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test1@example.com',
        password: 'password123'
      });

    if (!loginRes.body.data || !loginRes.body.data.token) {
      console.error('Login response:', loginRes.body);
      throw new Error('Failed to get auth token');
    }

    authToken = loginRes.body.data.token;

    // Create test conversation
    testConversation = new Conversation({
      participants: [testUser1._id, testUser2._id]
    });
    await testConversation.save();

    // Create test message
    testMessage = new Message({
      conversation: testConversation._id,
      sender: testUser1._id,
      content: 'Hello!',
      type: 'text'
    });
    await testMessage.save();

    // Update conversation with last message
    testConversation.lastMessage = testMessage._id;
    testConversation.lastMessageAt = testMessage.createdAt;
    await testConversation.save();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('GET /chats', () => {
    it('should get user chats successfully', async () => {
      const res = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.conversations)).toBe(true);
      expect(res.body.data.conversations[0].participants).toHaveLength(2);
    });

    it('should handle pagination parameters', async () => {
      const res = await request(app)
        .get('/api/chats?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /chats/:chatId', () => {
    it('should get chat by id successfully', async () => {
      const res = await request(app)
        .get(`/api/chats/${testConversation._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversation._id.toString()).toBe(testConversation._id.toString());
    });

    it('should return 404 for non-existent chat', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/chats/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CHAT_NOT_FOUND');
    });
  });

  describe('POST /chats/:chatId/messages', () => {
    it('should send message successfully', async () => {
      const res = await request(app)
        .post(`/api/chats/${testConversation._id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'New message',
          type: 'text'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.content).toBe('New message');
    });

    it('should return 404 for non-existent chat', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/chats/${nonExistentId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'New message',
          type: 'text'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CHAT_NOT_FOUND');
    });

    it('should return 400 for empty message content', async () => {
      const res = await request(app)
        .post(`/api/chats/${testConversation._id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '',
          type: 'text'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 when sending message to chat not involving user', async () => {
      // Create a new conversation without testUser1
      const otherConversation = new Conversation({
        participants: [testUser2._id, new mongoose.Types.ObjectId()]
      });
      await otherConversation.save();

      const res = await request(app)
        .post(`/api/chats/${otherConversation._id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Unauthorized message',
          type: 'text'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /chats/:chatId/messages', () => {
    it('should get chat messages successfully', async () => {
      const res = await request(app)
        .get(`/api/chats/${testConversation._id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.messages)).toBe(true);
      expect(res.body.data.messages[0].content).toBe('Hello!');
    });

    it('should handle pagination parameters', async () => {
      const res = await request(app)
        .get(`/api/chats/${testConversation._id}/messages?limit=5&offset=0`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBeLessThanOrEqual(5);
    });

    it('should return 403 when accessing messages from chat not involving user', async () => {
      // Create a new conversation without testUser1
      const otherConversation = new Conversation({
        participants: [testUser2._id, new mongoose.Types.ObjectId()]
      });
      await otherConversation.save();

      const res = await request(app)
        .get(`/api/chats/${otherConversation._id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /chats/:chatId', () => {
    it('should delete chat successfully', async () => {
      const res = await request(app)
        .delete(`/api/chats/${testConversation._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Chat deleted successfully');
    });

    it('should return 404 for non-existent chat', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/chats/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CHAT_NOT_FOUND');
    });

    it('should return 403 when trying to delete chat not involving user', async () => {
      // Create a new conversation without testUser1
      const otherConversation = new Conversation({
        participants: [testUser2._id, new mongoose.Types.ObjectId()]
      });
      await otherConversation.save();

      const res = await request(app)
        .delete(`/api/chats/${otherConversation._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
}); 