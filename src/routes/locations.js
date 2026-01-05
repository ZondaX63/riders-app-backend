const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const locationService = require('../services/locationService');
const { formatLocation } = require('../utils/locationFormatter');
const {
  validateLocation,
  validateNearbyQuery,
  validateVisibility,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// Update user location
// Route (Controller) katmanı sadece request/response ile ilgilenir
// Business logic locationService'e taşındı
router.put('/me', [
  auth,
  validateLocation,
  handleValidationErrors
], async (req, res) => {
  try {
    const location = await locationService.updateUserLocation(
      req.user._id,
      req.body
    );

    res.json({
      success: true,
      data: {
        location: formatLocation(location)
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to update location'
      }
    });
  }
});

// Get own location
router.get('/me', auth, async (req, res) => {
  try {
    const location = await locationService.getUserLocation(req.user._id);

    if (!location) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'No active location found for user'
        }
      });
    }

    res.json({
      success: true,
      data: {
        location: formatLocation(location)
      }
    });
  } catch (error) {
    console.error('Get own location error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch location'
      }
    });
  }
});

// Toggle location visibility
router.patch('/me/visibility', [
  auth,
  validateVisibility,
  handleValidationErrors
], async (req, res) => {
  try {
    const { isVisible } = req.body;
    const location = await locationService.toggleVisibility(req.user._id, isVisible);

    res.json({
      success: true,
      data: {
        location: formatLocation(location)
      }
    });
  } catch (error) {
    console.error('Update visibility error:', error);
    
    if (error.message === 'User location not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update visibility'
      }
    });
  }
});

// Delete location (disable location sharing)
router.delete('/me', auth, async (req, res) => {
  try {
    const deleted = await locationService.deleteUserLocation(req.user._id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'No active location found for user'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Location sharing disabled'
      }
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to disable location sharing'
      }
    });
  }
});

// Get nearby users
// Geospatial query - PERFORMANCE CRITICAL!
// 2dsphere index kullanır (UserLocation modelinde tanımlı)
router.get('/nearby', [
  auth,
  validateNearbyQuery,
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5000,
      limit = 20
    } = req.query;

    const nearby = await locationService.getNearbyUsers(
      Number(latitude),
      Number(longitude),
      Number(radius),
      Number(limit),
      req.user._id
    );

    res.json({
      success: true,
      data: {
        locations: nearby.map(formatLocation),
        total: nearby.length
      }
    });
  } catch (error) {
    console.error('Fetch nearby locations error:', error);
    
    if (error.message === 'Invalid coordinates') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch nearby riders'
      }
    });
  }
});

// Get following users' locations
router.get('/following', auth, async (req, res) => {
  try {
    const includeSelf = Boolean(req.query.includeSelf);
    const following = Array.isArray(req.user.following) ? req.user.following : [];
    const followingIds = following.map((id) => id.toString());

    if (followingIds.length === 0 && !includeSelf) {
      return res.json({
        success: true,
        data: {
          locations: [],
          total: 0
        }
      });
    }

    const locations = await locationService.getFollowingLocations(
      followingIds,
      includeSelf,
      req.user._id.toString()
    );

    res.json({
      success: true,
      data: {
        locations: locations.map(formatLocation),
        total: locations.length
      }
    });
  } catch (error) {
    console.error('Fetch following locations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch following locations'
      }
    });
  }
});

router.get('/users/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user id'
        }
      });
    }

    const location = await UserLocation.findOne({ user: userId, isVisible: true })
      .populate('user', 'username fullName profilePicture motorcycleInfo');

    if (!location) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'User location not found or hidden'
        }
      });
    }

    res.json({
      success: true,
      data: {
        location: formatLocation(location)
      }
    });
  } catch (error) {
    console.error('Get user location error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch user location'
      }
    });
  }
});

module.exports = router;
