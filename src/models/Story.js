const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  views: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add virtual for expiresAt
storySchema.virtual('expiresAt').get(function() {
  return new Date(this.createdAt.getTime() + this.duration * 60 * 60 * 1000);
});

// Ensure virtuals are included in JSON
storySchema.set('toJSON', { virtuals: true });
storySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Story', storySchema); 