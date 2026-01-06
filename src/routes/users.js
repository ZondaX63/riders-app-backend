const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const User = require('../models/User');
const { createNotification } = require('../utils/notificationService');
const Notification = require('../models/Notification');
const Post = require('../models/Post');
const Route = require('../models/Route');

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;

    let users;
    if (!q || q.trim() === '') {
      // If no query, return all users (excluding current user)
      users = await User.find({ _id: { $ne: req.user._id } })
        .select('-password')
        .limit(100)
        .sort({ createdAt: -1 });
    } else {
      // Search by username or fullName
      users = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { fullName: { $regex: q, $options: 'i' } }
        ]
      }).select('-password');
    }

    res.json({
      success: true,
      data: {
        users,
        total: users.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Get current user profile (me)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Update current user profile (me)
router.put('/me', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error updating current user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Upload current user profile picture (me)
router.put('/me/profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { profilePicture: req.file.path } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Get user profile
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Update user profile
router.put('/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own profile'
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: req.body },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Upload profile picture
router.post('/:userId/profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { profilePicture: req.file.path } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Follow user
router.post('/:userId/follow', auth, async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'You cannot follow yourself'
        }
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { following: req.params.userId }
    });

    await User.findByIdAndUpdate(req.params.userId, {
      $addToSet: { followers: req.user.id }
    });

    await createNotification({
      type: 'follow',
      user: req.params.userId,
      fromUser: req.user._id,
      content: `${req.user.username} seni takip etmeye başladı.`,
      message: `${req.user.username} seni takip etmeye başladı.`
    });

    res.json({
      success: true,
      data: {
        message: 'Successfully followed user'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Unfollow user
router.delete('/:userId/follow', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: req.params.userId }
    });

    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { followers: req.user.id }
    });

    res.json({
      success: true,
      data: {
        message: 'Successfully unfollowed user'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Get user followers
router.get('/:userId/followers', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', '-password')
      .select('followers');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        followers: user.followers,
        total: user.followers.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Get user following
router.get('/:userId/following', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', '-password')
      .select('following');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        following: user.following,
        total: user.following.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Get posts for a specific user
router.get('/:userId/posts', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const posts = await Post.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });
    const total = await Post.countDocuments({ user: req.params.userId });
    res.json({
      success: true,
      data: { posts, total }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching user posts'
      }
    });
  }
});

// Get routes for a specific user
router.get('/:userId/routes', auth, async (req, res) => {
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

// Update user status
router.patch('/me/status', [
  auth,
  body('message').optional().isIn(['', 'Mola Verdim', 'Sürüşe Hazırım', 'Yardıma İhtiyacım Var', 'Kahve Arıyorum']).withMessage('Invalid status message'),
  body('customText').optional().isString().isLength({ max: 100 }).withMessage('Custom text must be under 100 characters')
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

    const updateData = {
      'status.updatedAt': new Date()
    };

    if (req.body.message !== undefined) {
      updateData['status.message'] = req.body.message;
    }
    if (req.body.customText !== undefined) {
      updateData['status.customText'] = req.body.customText;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update status'
      }
    });
  }
});

module.exports = router;