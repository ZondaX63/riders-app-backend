const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const MapPin = require('../models/MapPin');
const { emitMapPinCreated, emitMapPinDeleted } = require('../socket');

const router = express.Router();

const validationError = (req, res, next) => {
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
  return next();
};

const formatPin = (pin) => {
  if (!pin) return null;
  return pin.toClientJSON(true);
};

router.post('/', [
  auth,
  body('title').trim().isLength({ min: 1, max: 80 }).withMessage('Title is required and must be under 80 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('type').optional().isIn(['meetup', 'hazard', 'checkpoint', 'fuel', 'food', 'custom']).withMessage('Invalid pin type'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90').toFloat(),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180').toFloat(),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid ISO date').toDate(),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean').toBoolean(),
  validationError
], async (req, res) => {
  try {
    const {
      title,
      description = '',
      type = 'custom',
      latitude,
      longitude,
      expiresAt = null,
      isPublic = true
    } = req.body;

    const pin = await MapPin.create({
      user: req.user._id,
      title,
      description,
      type,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      expiresAt,
      isPublic
    });

    await pin.populate('user', 'username fullName profilePicture');

    emitMapPinCreated(pin);

    res.status(201).json({
      success: true,
      data: {
        pin: formatPin(pin)
      }
    });
  } catch (error) {
    console.error('Create map pin error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create map pin'
      }
    });
  }
});

router.get('/nearby', [
  auth,
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90').toFloat(),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180').toFloat(),
  query('radius').optional().isInt({ min: 100, max: 50000 }).withMessage('Radius must be between 100 and 50000 meters').toInt(),
  query('types').optional().matches(/^[a-z,]+$/i).withMessage('types must be a comma separated list'),
  validationError
], async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5000,
      types
    } = req.query;

    const filters = {
      isPublic: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)]
          },
          $maxDistance: Number(radius)
        }
      }
    };

    if (types) {
      filters.type = { $in: types.split(',').map((value) => value.trim()).filter(Boolean) };
    }

    const pins = await MapPin.find(filters)
      .limit(100)
      .sort({ createdAt: -1 })
      .populate('user', 'username fullName profilePicture');

    res.json({
      success: true,
      data: {
        pins: pins.map(formatPin),
        total: pins.length
      }
    });
  } catch (error) {
    console.error('Fetch nearby pins error:', error);
    if (error.code === 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid location query'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch nearby pins'
      }
    });
  }
});

router.get('/mine', auth, async (req, res) => {
  try {
    const pins = await MapPin.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'username fullName profilePicture');

    res.json({
      success: true,
      data: {
        pins: pins.map(formatPin),
        total: pins.length
      }
    });
  } catch (error) {
    console.error('Fetch own pins error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch map pins'
      }
    });
  }
});

router.delete('/:pinId', auth, async (req, res) => {
  try {
    const { pinId } = req.params;

    if (!mongoose.isValidObjectId(pinId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pin id'
        }
      });
    }

    const pin = await MapPin.findById(pinId);

    if (!pin) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PIN_NOT_FOUND',
          message: 'Map pin not found'
        }
      });
    }

    if (pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own map pins'
        }
      });
    }

    await MapPin.deleteOne({ _id: pinId });

    emitMapPinDeleted(pin);

    res.json({
      success: true,
      data: {
        message: 'Map pin deleted'
      }
    });
  } catch (error) {
    console.error('Delete map pin error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete map pin'
      }
    });
  }
});

module.exports = router;
