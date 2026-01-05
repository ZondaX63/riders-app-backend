const extractCoordinates = (doc) => {
  if (!doc) {
    return [null, null];
  }

  const source = doc.location?.coordinates;
  if (Array.isArray(source) && source.length === 2) {
    return [Number(source[0]), Number(source[1])];
  }

  return [null, null];
};

const formatLocation = (doc) => {
  if (!doc) {
    return null;
  }

  const payload = doc.toObject ? doc.toObject({ virtuals: false }) : doc;
  const [longitude, latitude] = extractCoordinates(payload);

  const response = {
    id: payload._id,
    userId: payload.user?._id || payload.user,
    latitude,
    longitude,
    speed: payload.speed ?? null,
    heading: payload.heading ?? null,
    altitude: payload.altitude ?? null,
    accuracy: payload.accuracy ?? null,
    isVisible: Boolean(payload.isVisible),
    status: payload.status,
    lastSeenAt: payload.lastSeenAt,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt
  };

  if (payload.user && typeof payload.user === 'object' && payload.user._id) {
    response.user = {
      id: payload.user._id,
      username: payload.user.username,
      fullName: payload.user.fullName,
      profilePicture: payload.user.profilePicture,
      motorcycleInfo: payload.user.motorcycleInfo
    };
  }

  return response;
};

module.exports = {
  formatLocation
};
