const mongoose = require('mongoose');

const userLocationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2 &&
            value[0] >= -180 && value[0] <= 180 &&
            value[1] >= -90 && value[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    }
  },
  speed: {
    type: Number,
    default: null
  },
  heading: {
    type: Number,
    default: null
  },
  altitude: {
    type: Number,
    default: null
  },
  accuracy: {
    type: Number,
    default: null
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'idle', 'hidden'],
    default: 'active'
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userLocationSchema.index({ location: '2dsphere' });
userLocationSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 600 });

userLocationSchema.methods.toClientJSON = function toClientJSON() {
  const coordinates = this.location?.coordinates || [null, null];
  return {
    id: this._id,
    userId: this.user,
    latitude: coordinates[1],
    longitude: coordinates[0],
    speed: this.speed,
    heading: this.heading,
    altitude: this.altitude,
    accuracy: this.accuracy,
    isVisible: this.isVisible,
    status: this.status,
    lastSeenAt: this.lastSeenAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const UserLocation = mongoose.model('UserLocation', userLocationSchema);

module.exports = UserLocation;
