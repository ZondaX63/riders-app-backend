const mongoose = require('mongoose');

const mapPinSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['meetup', 'hazard', 'checkpoint', 'fuel', 'food', 'custom'],
    default: 'custom'
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
  expiresAt: {
    type: Date,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

mapPinSchema.index({ location: '2dsphere' });
mapPinSchema.index({ user: 1, createdAt: -1 });
mapPinSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

mapPinSchema.methods.toClientJSON = function toClientJSON(populateUser = false) {
  const coordinates = this.location?.coordinates || [null, null];
  const base = {
    id: this._id,
    userId: this.user?._id || this.user,
    title: this.title,
    description: this.description,
    type: this.type,
    latitude: coordinates[1],
    longitude: coordinates[0],
    isPublic: this.isPublic,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };

  if (populateUser && this.user && typeof this.user === 'object' && this.user._id) {
    base.user = {
      id: this.user._id,
      username: this.user.username,
      fullName: this.user.fullName,
      profilePicture: this.user.profilePicture
    };
  }

  return base;
};

const MapPin = mongoose.model('MapPin', mapPinSchema);

module.exports = MapPin;
