const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Route = require('../models/Route');
const Notification = require('../models/Notification');

// Create route
router.post('/', auth, [
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  body('waypoints').isArray().notEmpty(),
  body('waypoints.*.latitude').isFloat(),
  body('waypoints.*.longitude').isFloat(),
  body('waypoints.*.name').optional().trim(),
  body('waypoints.*.order').isInt({ min: 0 }),
  body('isPublic').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        }
      });
    }

    const { name, description, waypoints, isPublic } = req.body;

    // Calculate distance and duration (simplified)
    const distance = calculateRouteDistance(waypoints);
    const duration = calculateRouteDuration(distance);

    const route = new Route({
      user: req.user._id,
      name,
      description,
      waypoints,
      isPublic,
      distance,
      duration
    });

    await route.save();
    await route.populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      data: { route }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error creating route'
      }
    });
  }
});

// Get public routes
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const routes = await Route.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .populate('user', 'username fullName profilePicture')
      .populate('sharedWith.user', 'username fullName profilePicture')
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Route.countDocuments({ isPublic: true });

    res.json({
      success: true,
      data: {
        routes,
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching routes'
      }
    });
  }
});

// Get user routes
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const routes = await Route.find({
      $or: [
        { user: req.params.userId },
        { 'sharedWith.user': req.params.userId }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('user', 'username fullName profilePicture')
      .populate('sharedWith.user', 'username fullName profilePicture')
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Route.countDocuments({
      $or: [
        { user: req.params.userId },
        { 'sharedWith.user': req.params.userId }
      ]
    });

    res.json({
      success: true,
      data: {
        routes,
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching user routes'
      }
    });
  }
});

// Get routes for a specific user (alias for /api/routes/user/:userId)
router.get('/users/:userId/routes', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const routes = await Route.find({
      $or: [
        { user: req.params.userId },
        { 'sharedWith.user': req.params.userId }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('user', 'username fullName profilePicture')
      .populate('sharedWith.user', 'username fullName profilePicture')
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    const total = await Route.countDocuments({
      $or: [
        { user: req.params.userId },
        { 'sharedWith.user': req.params.userId }
      ]
    });
    res.json({
      success: true,
      data: { routes, total }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching user routes'
      }
    });
  }
});

// Get route details
router.get('/:routeId', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId)
      .populate('user', 'username fullName profilePicture')
      .populate('sharedWith.user', 'username fullName profilePicture');

    if (!route) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      });
    }

    // Check if user has access to the route
    if (!route.isPublic &&
      route.user.toString() !== req.user._id.toString() &&
      !route.sharedWith.some(share => share.user.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this route'
        }
      });
    }

    res.json({
      success: true,
      data: { route }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching route details'
      }
    });
  }
});

// Share route
router.post('/:routeId/share', auth, [
  body('userId').notEmpty()
], async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      });
    }

    // Check if user owns the route
    if (route.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only share your own routes'
        }
      });
    }

    // Check if already shared with user
    if (route.sharedWith.some(share => share.user.toString() === req.body.userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_SHARED',
          message: 'Route is already shared with this user'
        }
      });
    }

    route.sharedWith.push({
      user: req.body.userId
    });
    await route.save();

    // Create notification
    const notification = new Notification({
      user: req.body.userId,
      fromUser: req.user._id,
      type: 'route_share',
      content: `${req.user.username} shared a route with you`,
      relatedRoute: route._id
    });
    await notification.save();

    res.json({
      success: true,
      data: {
        message: 'Route shared successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error sharing route'
      }
    });
  }
});

// Delete route
router.delete('/:routeId', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      });
    }

    if (route.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own routes'
        }
      });
    }

    await Route.findByIdAndDelete(req.params.routeId);

    res.json({
      success: true,
      data: {
        message: 'Route deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error deleting route'
      }
    });
  }
});

// Update a route
router.put('/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const updates = req.body;

    // Find the route
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      });
    }

    // Check if user owns the route
    if (route.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this route'
        }
      });
    }

    // Update route fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'user') { // Prevent updating protected fields
        route[key] = updates[key];
      }
    });

    // Save the updated route
    await route.save();

    res.status(200).json({
      success: true,
      data: {
        route
      }
    });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while updating the route'
      }
    });
  }
});

// Helper functions
function calculateRouteDistance(waypoints) {
  // Simplified distance calculation
  // In a real application, you would use a proper distance calculation algorithm
  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const lat1 = waypoints[i].latitude;
    const lon1 = waypoints[i].longitude;
    const lat2 = waypoints[i + 1].latitude;
    const lon2 = waypoints[i + 1].longitude;

    // Haversine formula
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    totalDistance += distance;
  }
  return totalDistance;
}

function calculateRouteDuration(distance) {
  // Simplified duration calculation
  // Assuming average speed of 60 km/h
  const averageSpeed = 60; // km/h
  return (distance / averageSpeed) * 60; // in minutes
}

function toRad(value) {
  return value * Math.PI / 180;
}

module.exports = router;