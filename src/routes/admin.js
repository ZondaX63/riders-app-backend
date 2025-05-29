const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');

// Test endpoint for admin access
router.get('/test', adminAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Admin access granted'
    }
  });
});

module.exports = router; 