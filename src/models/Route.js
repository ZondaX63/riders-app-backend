const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  waypoints: [{
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      trim: true
    },
    order: {
      type: Number,
      required: true
    }
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  distance: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient querying
routeSchema.index({ user: 1, createdAt: -1 });
routeSchema.index({ isPublic: 1, createdAt: -1 });

const Route = mongoose.model('Route', routeSchema);

module.exports = Route; 