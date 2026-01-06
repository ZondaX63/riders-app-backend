const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['follow', 'like', 'comment', 'route_share', 'group_ride'],
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: String,
  message: String,
  content: String,
  read: {
    type: Boolean,
    default: false
  },
  relatedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  relatedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  relatedGroupChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat'
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 