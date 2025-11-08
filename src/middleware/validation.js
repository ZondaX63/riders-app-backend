/**
 * Validation Middleware
 * 
 * Express-validator kullanarak gelen verileri doğrular.
 * Kullanıcıdan gelen veriye ASLA güvenme!
 * 
 * Kullanım:
 * router.post('/endpoint', validateLocation, handleValidationErrors, controller)
 */

const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation hatalarını yakalayan middleware
 * 
 * Bu middleware, validation chain'lerinden sonra çağrılır.
 * Eğer hata varsa, isteği controller'a ulaşmadan reddeder.
 */
const handleValidationErrors = (req, res, next) => {
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
  
  next();
};

/**
 * Location validation rules
 */
const validateLocation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  
  body('speed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Speed must be a positive number')
    .toFloat(),
  
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360')
    .toFloat(),
  
  body('altitude')
    .optional()
    .isFloat()
    .withMessage('Altitude must be a number')
    .toFloat(),
  
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number')
    .toFloat(),
  
  body('isVisible')
    .optional()
    .isBoolean()
    .withMessage('isVisible must be a boolean')
    .toBoolean(),
  
  body('status')
    .optional()
    .isIn(['active', 'idle', 'hidden'])
    .withMessage('Invalid status value')
];

/**
 * Nearby location query validation
 */
const validateNearbyQuery = [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  
  query('radius')
    .optional()
    .isInt({ min: 100, max: 50000 })
    .withMessage('Radius must be between 100 and 50000 meters')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt()
];

/**
 * Visibility toggle validation
 */
const validateVisibility = [
  body('isVisible')
    .isBoolean()
    .withMessage('isVisible must be a boolean')
    .toBoolean()
];

/**
 * User status validation
 */
const validateUserStatus = [
  body('message')
    .optional()
    .isIn(['', 'Mola Verdim', 'Sürüşe Hazırım', 'Yardıma İhtiyacım Var', 'Kahve Arıyorum'])
    .withMessage('Invalid status message'),
  
  body('customText')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Custom text must be under 100 characters')
    .trim()
];

/**
 * Post creation validation
 */
const validatePost = [
  body('text')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Post text must be under 2000 characters')
    .trim(),
  
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  
  body('location.name')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Location name must be under 200 characters'),
  
  body('location.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Location latitude must be between -90 and 90'),
  
  body('location.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Location longitude must be between -180 and 180')
];

/**
 * MongoDB ObjectId validation
 */
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`)
];

/**
 * Group chat route attachment validation
 */
const validateRouteAttachment = [
  body('routeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid route ID')
];

/**
 * Ride status validation
 */
const validateRideStatus = [
  body('rideStatus')
    .optional()
    .isIn(['planned', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid ride status'),
  
  body('rideStartTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid ride start time')
    .toDate(),
  
  body('rideEndTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid ride end time')
    .toDate()
];

module.exports = {
  handleValidationErrors,
  validateLocation,
  validateNearbyQuery,
  validateVisibility,
  validateUserStatus,
  validatePost,
  validateObjectId,
  validateRouteAttachment,
  validateRideStatus
};
