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
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Calculate expiresAt before saving
storySchema.pre('validate', function (next) {
  if (this.isNew || this.isModified('duration')) {
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    this.expiresAt = new Date(this.createdAt.getTime() + this.duration * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Story', storySchema);