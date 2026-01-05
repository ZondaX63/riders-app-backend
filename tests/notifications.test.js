const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { connectDB, closeDB, clearDB } = require('./db');

describe('Notification Endpoints', () => {
  let testUser;
  let otherUser;
  let authToken;
  let testNotification;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    // Create test users
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User'
    });
    await testUser.save();

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
    authToken = loginRes.body.data.token;

    // Create test notification
    testNotification = new Notification({
      user: testUser._id,
      type: 'follow',
      fromUser: otherUser._id,
      content: 'started following you',
      read: false
    });
    await testNotification.save();
  });

  afterEach(async () => {
    await clearDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  describe('GET /notifications', () => {
    it('should get notifications successfully', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const res = await request(app)
        .get('/api/notifications?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.length).toBeLessThanOrEqual(5);
    });

    it('should filter notifications by type', async () => {
      // Create a different type of notification
      const likeNotification = new Notification({
        user: testUser._id,
        type: 'like',
        fromUser: otherUser._id,
        content: 'liked your post',
        read: false
      });
      await likeNotification.save();

      const res = await request(app)
        .get('/api/notifications?type=follow')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.every(n => n.type === 'follow')).toBe(true);
    });

    it('should filter notifications by read status', async () => {
      // Create a read notification
      const readNotification = new Notification({
        user: testUser._id,
        type: 'comment',
        fromUser: otherUser._id,
        content: 'commented on your post',
        read: true
      });
      await readNotification.save();

      const res = await request(app)
        .get('/api/notifications?read=false')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.every(n => !n.read)).toBe(true);
    });
  });

  describe('PUT /notifications/:notificationId/read', () => {
    it('should mark notification as read successfully', async () => {
      const res = await request(app)
        .put(`/api/notifications/${testNotification._id}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Notification marked as read');
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .put('/api/notifications/nonexistentid/read')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('should return 403 when marking another user\'s notification as read', async () => {
      // Create notification for other user
      const otherNotification = new Notification({
        user: otherUser._id,
        type: 'follow',
        fromUser: testUser._id,
        content: 'started following you',
        read: false
      });
      await otherNotification.save();

      const res = await request(app)
        .put(`/api/notifications/${otherNotification._id}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('should mark all notifications as read successfully', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('All notifications marked as read');
    });
  });

  describe('DELETE /notifications/:notificationId', () => {
    it('should delete notification successfully', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${testNotification._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Notification deleted successfully');
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/notifications/nonexistentid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('should return 403 when deleting another user\'s notification', async () => {
      // Create notification for other user
      const otherNotification = new Notification({
        user: otherUser._id,
        type: 'follow',
        fromUser: testUser._id,
        content: 'started following you',
        read: false
      });
      await otherNotification.save();

      const res = await request(app)
        .delete(`/api/notifications/${otherNotification._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /notifications', () => {
    it('should delete all notifications successfully', async () => {
      const res = await request(app)
        .delete('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('All notifications deleted successfully');
    });
  });
}); 