const request = require('supertest');
const { connectDB, closeDB, clearDB } = require('./db');
const app = require('../src/app');
const GroupChat = require('../src/models/GroupChat');
const User = require('../src/models/User');

describe('Group Chat Tests', () => {
  let user1, user2, user3;
  let user1Token, user2Token, user3Token;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  beforeEach(async () => {
    await clearDB();

    // Create test users
    user1 = await User.create({
      username: 'user1',
      email: 'user1@example.com',
      password: 'password123',
      fullName: 'User One'
    });

    user2 = await User.create({
      username: 'user2',
      email: 'user2@example.com',
      password: 'password123',
      fullName: 'User Two'
    });

    user3 = await User.create({
      username: 'user3',
      email: 'user3@example.com',
      password: 'password123',
      fullName: 'User Three'
    });

    // Get auth tokens
    const user1Response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user1@example.com',
        password: 'password123'
      });
    user1Token = user1Response.body.data.token;

    const user2Response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user2@example.com',
        password: 'password123'
      });
    user2Token = user2Response.body.data.token;

    const user3Response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user3@example.com',
        password: 'password123'
      });
    user3Token = user3Response.body.data.token;
  });

  describe('Group Chat Creation', () => {
    it('should create a new group chat', async () => {
      const response = await request(app)
        .post('/api/group-chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Group',
          description: 'A test group chat',
          isPrivate: false
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Group');
      expect(response.body.data.creator.toString()).toBe(user1._id.toString());
      expect(response.body.data.members).toHaveLength(1);
      expect(response.body.data.members[0].user.toString()).toBe(user1._id.toString());
      expect(response.body.data.members[0].role).toBe('admin');
    });

    it('should not create a group chat without authentication', async () => {
      const response = await request(app)
        .post('/api/group-chats')
        .send({
          name: 'Test Group',
          description: 'A test group chat'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Group Chat Access', () => {
    let groupChat;

    beforeEach(async () => {
      // Create a test group chat
      groupChat = await GroupChat.create({
        name: 'Test Group',
        description: 'A test group chat',
        creator: user1._id,
        members: [{ user: user1._id, role: 'admin' }]
      });
    });

    it('should get all accessible group chats', async () => {
      const response = await request(app)
        .get('/api/group-chats')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._id.toString()).toBe(groupChat._id.toString());
    });

    it('should get a specific group chat', async () => {
      const response = await request(app)
        .get(`/api/group-chats/${groupChat._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe(groupChat._id.toString());
    });

    it('should not access private group chat without membership', async () => {
      // Make the group private
      groupChat.isPrivate = true;
      await groupChat.save();

      const response = await request(app)
        .get(`/api/group-chats/${groupChat._id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Group Chat Members', () => {
    let groupChat;

    beforeEach(async () => {
      // Create a test group chat
      groupChat = await GroupChat.create({
        name: 'Test Group',
        description: 'A test group chat',
        creator: user1._id,
        members: [{ user: user1._id, role: 'admin' }]
      });
    });

    it('should add a member to the group chat', async () => {
      const response = await request(app)
        .post(`/api/group-chats/${groupChat._id}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user2._id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.members).toHaveLength(2);
      expect(response.body.data.members[1].user.toString()).toBe(user2._id.toString());
    });

    it('should not add a member without admin rights', async () => {
      const response = await request(app)
        .post(`/api/group-chats/${groupChat._id}/members`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          userId: user3._id
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Group Chat Messages', () => {
    let groupChat;

    beforeEach(async () => {
      // Create a test group chat with two members
      groupChat = await GroupChat.create({
        name: 'Test Group',
        description: 'A test group chat',
        creator: user1._id,
        members: [
          { user: user1._id, role: 'admin' },
          { user: user2._id, role: 'member' }
        ]
      });
    });

    it('should send a text message to the group chat', async () => {
      const response = await request(app)
        .post(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Hello, group!',
          type: 'text'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Hello, group!');
      expect(response.body.data.type).toBe('text');
    });

    it('should send a location message to the group chat', async () => {
      const response = await request(app)
        .post(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'My location',
          type: 'location',
          location: {
            lat: 41.0082,
            lng: 28.9784
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('location');
      expect(response.body.data.location).toBeDefined();
      expect(response.body.data.location.lat).toBe(41.0082);
      expect(response.body.data.location.lng).toBe(28.9784);
    });

    it('should get messages from the group chat', async () => {
      // Add some messages first
      await request(app)
        .post(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Message 1',
          type: 'text'
        });

      await request(app)
        .post(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'Message 2',
          type: 'text'
        });

      const response = await request(app)
        .get(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].content).toBe('Message 2');
      expect(response.body.data[1].content).toBe('Message 1');
    });

    it('should not send message without membership', async () => {
      const response = await request(app)
        .post(`/api/group-chats/${groupChat._id}/messages`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          content: 'Hello, group!',
          type: 'text'
        });

      expect(response.status).toBe(403);
    });
  });
}); 